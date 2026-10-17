using GestioApp.Contracts;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
namespace GestioApp.Agent;

public sealed class InventoryWorker(InventoryService collector, StateStore store, ApiClient api,
    AgentOptions options, ILogger<InventoryWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        Inventory? pending = null;
        var nextRead = DateTimeOffset.MinValue;
        try
        {
            while (!ct.IsCancellationRequested)
            {
                try
                {
                    if (DateTimeOffset.UtcNow >= nextRead)
                    {
                        pending = collector.Read();
                        store.Update(pending, options.ApiEnabled ? "Pendiente de envío" : "API desactivada");
                        nextRead = DateTimeOffset.UtcNow.AddSeconds(options.InventorySeconds);
                    }
                    if (pending is not null && options.ApiEnabled)
                    {
                        var error = await api.SendAsync(options.InventoryEndpoint, pending, ct);
                        store.Update(status: error ?? "Aceptado por API (HTTP 2xx)",
                            acceptedId: error is null ? pending.InventoryId : null);
                        if (error is null) pending = null;
                    }
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
                catch (Exception ex) { log.LogError(ex, "Error en ciclo de inventario"); }
                await Task.Delay(TimeSpan.FromSeconds(30), ct);
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
    }
}

public sealed class HeartbeatWorker(StateStore store, ApiClient api, AgentOptions options,
    ILogger<HeartbeatWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        try
        {
            while (!ct.IsCancellationRequested)
            {
                try
                {
                    store.Update();
                    if (options.ApiEnabled)
                    {
                        var error = await api.SendAsync(options.HeartbeatEndpoint,
                            new { schemaVersion = 1, deviceId = store.DeviceId, sentAtUtc = DateTimeOffset.UtcNow }, ct);
                        if (error is not null) log.LogWarning("Heartbeat: {Reason}", error);
                    }
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
                catch (Exception ex) { log.LogError(ex, "Error de heartbeat"); }
                await Task.Delay(TimeSpan.FromSeconds(options.HeartbeatSeconds), ct);
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
    }
}
