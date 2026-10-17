using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text.Json;
using GestioApp.Contracts;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
namespace GestioApp.Agent;

public sealed class ActivityWorker(AgentOptions options, StateStore state, ApiClient api,
    ILogger<ActivityWorker> log) : BackgroundService
{
    private readonly string queue = Path.Combine(Files.Root, "ActivityQueue");
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!options.ActivityEnabled) return;
        // El instalador crea esta carpeta con ACL privada (LocalService, SYSTEM y administradores).
        if (!Directory.Exists(queue)) { log.LogError("Falta ActivityQueue: ejecutar instalador 0.3"); return; }
        await Task.WhenAll(ReceiveLoop(ct), SendLoop(ct));
    }
    private async Task ReceiveLoop(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var security = new PipeSecurity();
                security.SetAccessRuleProtection(true, false);
                security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.NetworkSid, null),
                    PipeAccessRights.FullControl, AccessControlType.Deny));
                security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.LocalServiceSid, null),
                    PipeAccessRights.FullControl, AccessControlType.Allow));
                security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null),
                    PipeAccessRights.FullControl, AccessControlType.Allow));
                security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.InteractiveSid, null),
                    PipeAccessRights.ReadWrite | PipeAccessRights.Synchronize, AccessControlType.Allow));
                using var pipe = NamedPipeServerStreamAcl.Create(ActivityProtocol.PipeName, PipeDirection.InOut, 1,
                    PipeTransmissionMode.Byte, PipeOptions.Asynchronous | PipeOptions.FirstPipeInstance, 16384, 16384, security);
                await pipe.WaitForConnectionAsync(ct);
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(TimeSpan.FromSeconds(5));
                var batch = await ActivityProtocol.ReadAsync<ActivityBatch>(pipe, timeout.Token);
                string? sid = null; string name = "";
                pipe.RunAsClient(() =>
                {
                    using var identity = WindowsIdentity.GetCurrent();
                    sid = identity.User?.Value; name = identity.Name;
                });
                string receipt;
                if (sid is null || !batch.IsValid()) receipt = "REJECT: registro inválido";
                else
                {
                    // SID proviene del token Windows del emisor, nunca del JSON.
                    var envelope = new ActivityEnvelope(1, state.DeviceId, sid, name, DateTimeOffset.UtcNow, batch);
                    string file = Path.Combine(queue, batch.BatchId + ".json");
                    if (File.Exists(file))
                    {
                        var prior = JsonSerializer.Deserialize<ActivityEnvelope>(File.ReadAllText(file), ActivityProtocol.Json);
                        receipt = prior?.UserSid == sid && prior.Activity == batch ? batch.BatchId.ToString() : "REJECT: ID en conflicto";
                    }
                    else if (Directory.EnumerateFiles(queue, "*.json").Take(20000).Count() >= 20000)
                        receipt = "Cola del servicio llena; pendiente local";
                    else
                    {
                        ActivityProtocol.SaveNew(file, envelope);
                        receipt = batch.BatchId.ToString();
                    }
                }
                await ActivityProtocol.WriteAsync(pipe, receipt, timeout.Token);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                log.LogWarning("Actividad local: {Reason}", ex.GetType().Name);
                try { await Task.Delay(1000, ct); } catch (OperationCanceledException) { break; }
            }
        }
    }
    private async Task SendLoop(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                if (options.ActivityApiEnabled)
                    foreach (var file in Directory.EnumerateFiles(queue, "*.json").Order().Take(100))
                    {
                        ActivityEnvelope? envelope;
                        try { envelope = JsonSerializer.Deserialize<ActivityEnvelope>(await File.ReadAllTextAsync(file, ct), ActivityProtocol.Json); }
                        catch (JsonException) { File.Move(file, file + ".invalid", true); log.LogWarning("JSON inválido aislado"); continue; }
                        if (envelope is null || envelope.Activity is null || !envelope.Activity.IsValid())
                        {
                            File.Move(file, file + ".invalid", true); log.LogWarning("Registro local inválido aislado"); continue;
                        }
                        string? error = await api.SendActivityAsync(options.ActivityEndpoint, envelope, ct);
                        if (error is not null) { log.LogWarning("API de actividad: {Reason}", error); break; }
                        File.Delete(file); // Solo después de 200 + batchId confirmado.
                    }
                await Task.Delay(TimeSpan.FromSeconds(30), ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                log.LogWarning("Cola de actividad: {Reason}", ex.GetType().Name);
                try { await Task.Delay(30000, ct); } catch (OperationCanceledException) { break; }
            }
        }
    }
}
