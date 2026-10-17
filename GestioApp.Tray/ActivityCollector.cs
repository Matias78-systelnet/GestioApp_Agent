using System.IO.Pipes;
using System.Security.Principal;
using System.Text.Json;
using GestioApp.Contracts;
namespace GestioApp.Tray;

internal sealed class ActivityCollector : IDisposable
{
    private readonly SessionProbe probe = new();
    private readonly Guid collectorId = Guid.NewGuid();
    private readonly System.Windows.Forms.Timer timer = new() { Interval = 5000 };
    private readonly CancellationTokenSource stop = new();
    private readonly string folder;
    private readonly string root;
    private readonly string enabledFile;
    private readonly double[] seconds = new double[5];
    private readonly double[] totals = new double[5];
    private DateTimeOffset started;
    private long lastTick;
    private string lastState = "Unknown", current = "Pausado", transfer = "Sin envíos";
    private bool busy, disposed;
    public bool Enabled { get; private set; }
    public string Summary => $"Medición {(Enabled ? "ACTIVA" : "PAUSADA")} · Estado: {current}\r\n"
        + "Se miden sesiones e inactividad. No se registran teclas, pantallas ni aplicaciones.\r\n"
        + "Inactividad: 5 minutos sin entrada. Muestreo: 5 segundos.\r\n\r\n"
        + $"Desde que abriste este ícono (no es un reporte diario):\r\n"
        + $"Activo: {totals[0]:F0} s\r\nInactivo: {totals[1]:F0} s\r\nBloqueado: {totals[2]:F0} s\r\n"
        + $"Desconectado: {totals[3]:F0} s\r\nDesconocido: {totals[4]:F0} s\r\n\r\n"
        + $"Entrega al servicio: {transfer}\r\nCerrar Tray detiene la medición. Pausar no borra registros pendientes.\r\n"
        + "El acuse local confirma almacenamiento en el servicio, no recepción en la API.";
    public ActivityCollector()
    {
        root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "GestioApp", "Activity");
        // Cola separada por sesión para impedir que dos sesiones del mismo usuario compitan.
        folder = Path.Combine(root, probe.SessionId.ToString());
        Directory.CreateDirectory(folder);
        enabledFile = Path.Combine(folder, "enabled.txt");
        Enabled = File.Exists(enabledFile);
        Reset();
        timer.Tick += async (_, _) =>
        {
            if (disposed) return;
            try { Sample(); Flush(false); }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            { transfer = "No se pudo guardar: " + ex.GetType().Name; }
            if (busy) return;
            busy = true;
            try { await DeliverAsync(); }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or OperationCanceledException)
            { transfer = "Pendiente: " + ex.GetType().Name; }
            finally { busy = false; }
        };
        timer.Start();
    }
    public void Toggle()
    {
        try
        {
            if (Enabled) { Sample(); Flush(true); File.Delete(enabledFile); Enabled = false; current = "Pausado"; }
            else
            {
                Flush(true);
                if (seconds.Sum() > 0) return; // No reiniciar el ancla si la cola sigue llena.
                File.WriteAllText(enabledFile, "Medición visible habilitada por el usuario"); Enabled = true; Reset();
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        { transfer = "No se pudo cambiar medición: " + ex.GetType().Name; }
    }
    private void Reset() { started = DateTimeOffset.UtcNow; lastTick = Environment.TickCount64; lastState = probe.Read(); }
    private void Sample()
    {
        if (!Enabled) return;
        long now = Environment.TickCount64;
        double delta = (now - lastTick) / 1000d;
        current = probe.Read();
        int bucket = ActivityMath.Bucket(lastState, current, delta);
        if (bucket < 0) bucket = 4;
        if (delta > 0) { seconds[bucket] += delta; totals[bucket] += delta; }
        lastTick = now; lastState = current;
    }
    private void Flush(bool force)
    {
        double total = seconds.Sum();
        if (total <= 0 || (!force && total < 60)) return;
        if (Directory.EnumerateFiles(folder, "*.json").Take(1440).Count() >= 1440)
        {
            Enabled = false; File.Delete(enabledFile);
            transfer = "Cola local llena: medición detenida. Reanudar tras recuperar servicio.";
            return;
        }
        // El intervalo UTC se deriva de tiempo monotónico: cambios del reloj no crean horas activas.
        var batch = new ActivityBatch(1, Guid.NewGuid(), collectorId, probe.SessionId, started,
            started.AddSeconds(total), seconds[0], seconds[1], seconds[2], seconds[3], seconds[4], 300);
        if (!batch.IsValid()) throw new InvalidDataException("Intervalo fuera de límites; reiniciar recolector");
        ActivityProtocol.SaveNew(Path.Combine(folder, batch.BatchId + ".json"), batch);
        Array.Clear(seconds); started = DateTimeOffset.UtcNow;
    }
    private async Task DeliverAsync()
    {
        foreach (string file in Directory.EnumerateFiles(root, "*.json", SearchOption.AllDirectories).Order().Take(5))
        {
            ActivityBatch? batch;
            try { batch = JsonSerializer.Deserialize<ActivityBatch>(File.ReadAllText(file), ActivityProtocol.Json); }
            catch (JsonException) { File.Move(file, file + ".invalid", true); continue; }
            if (batch is null || !batch.IsValid()) { File.Move(file, file + ".invalid", true); continue; }
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stop.Token);
            timeout.CancelAfter(TimeSpan.FromSeconds(3));
            using var pipe = new NamedPipeClientStream(".", ActivityProtocol.PipeName, PipeDirection.InOut,
                PipeOptions.Asynchronous, TokenImpersonationLevel.Impersonation);
            await pipe.ConnectAsync(timeout.Token);
            await ActivityProtocol.WriteAsync(pipe, batch, timeout.Token);
            string receipt = await ActivityProtocol.ReadAsync<string>(pipe, timeout.Token);
            if (receipt.StartsWith("REJECT:", StringComparison.Ordinal))
            { File.Move(file, file + ".rejected", true); transfer = receipt; continue; }
            if (receipt != batch.BatchId.ToString()) { transfer = receipt; break; }
            File.Delete(file);
            transfer = "Guardado en servicio: " + DateTime.Now.ToString("HH:mm:ss");
        }
    }
    public void Dispose()
    {
        disposed = true; timer.Stop(); stop.Cancel();
        try { Sample(); Flush(true); } catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
        timer.Dispose(); probe.Dispose();
    }
}
