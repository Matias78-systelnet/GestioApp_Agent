using System.Drawing;
using System.Text;
using System.Text.Json;
using GestioApp.Contracts;

namespace GestioApp.Tray;

public sealed class TrayApplicationContext : ApplicationContext
{
    private readonly ActivityCollector? activity;
    private readonly TextBox activityView;
    private readonly NotifyIcon icon;
    private readonly Icon image;
    private readonly ContextMenuStrip menu = new();
    private readonly System.Windows.Forms.Timer timer = new() { Interval = 5000 };
    private readonly Form window;
    private readonly TextBox summary;
    private readonly TextBox json;
    private readonly Label status;
    public TrayApplicationContext()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Assets", "gestioapp.ico");
        image = File.Exists(path) ? new Icon(path) : (Icon)SystemIcons.Application.Clone();
        window = new Form { Text = "GestioApp · Inventario", Size = new Size(760, 600), MinimumSize = new Size(540, 380),
            StartPosition = FormStartPosition.CenterScreen, Icon = image };
        status = new Label { Dock = DockStyle.Top, Height = 65, Padding = new Padding(10) };
        var tabs = new TabControl { Dock = DockStyle.Fill };
        summary = Box(); json = Box(); activityView = Box();
        var first = new TabPage("Equipo"); first.Controls.Add(summary);
        var second = new TabPage("JSON enviado a la API"); second.Controls.Add(json);
        tabs.TabPages.Add(first); tabs.TabPages.Add(second);
        var activityTab = new TabPage("Actividad de sesión"); activityTab.Controls.Add(activityView); tabs.TabPages.Add(activityTab);
        try { activity = new ActivityCollector(); }
        catch (Exception ex) { activityView.Text = "Recolector no disponible: " + ex.GetType().Name; }
        window.Controls.Add(tabs); window.Controls.Add(status);
        window.FormClosing += (_, e) => { if (e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; window.Hide(); } };
        menu.Items.Add("Ver inventario", null, (_, _) => Open());
        menu.Items.Add("Actualizar vista", null, (_, _) => Refresh());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Iniciar / pausar medición de sesión", null, (_, _) =>
        {
            if (activity is null) return;
            if (!activity.Enabled && MessageBox.Show("Se medirán tiempos activos, inactivos y bloqueados de tu sesión. "
                + "Los registros podrán enviarse al servidor de la organización. No se capturan teclas ni pantallas. ¿Iniciar?",
                "GestioApp · Medición de sesión", MessageBoxButtons.YesNo, MessageBoxIcon.Information) != DialogResult.Yes) return;
            activity.Toggle(); Refresh();
        });
        menu.Items.Add("Salir del icono (el agente continúa)", null, (_, _) => ExitThread());
        icon = new NotifyIcon { Icon = image, Text = "GestioApp Agent", ContextMenuStrip = menu, Visible = true };
        icon.DoubleClick += (_, _) => Open();
        timer.Tick += (_, _) => Refresh(); timer.Start(); Refresh();
    }
    private static TextBox Box() => new() { Dock = DockStyle.Fill, Multiline = true, ReadOnly = true,
        ScrollBars = ScrollBars.Both, WordWrap = false, Font = new Font("Consolas", 10) };
    private void Open() { Refresh(); window.Show(); window.WindowState = FormWindowState.Normal; window.Activate(); }
    private static string GiB(ulong? bytes) => bytes.HasValue ? $"{bytes.Value / 1073741824.0:F2} GiB" : "No disponible";
    private void Refresh()
    {
        if (activity is not null) activityView.Text = activity.Summary;
        try
        {
            using var stream = new FileStream(Files.State, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            var state = JsonSerializer.Deserialize<AgentState>(stream, Files.Json) ?? throw new JsonException();
            var fresh = DateTimeOffset.UtcNow - state.ServiceSeenAtUtc < TimeSpan.FromMinutes(3);
            string actividad = fresh
                ? "Actividad local reciente"
                : "Sin actividad local reciente · datos anteriores";
            status.Text = actividad + Environment.NewLine
                + $"Inventario: {state.SendStatus}";
            icon.Text = (fresh ? "GestioApp · agente activo" : "GestioApp · datos anteriores")
                + (activity?.Enabled == true ? " · medición ON" : " · medición OFF");
            if (state.Inventory is not { } i) { summary.Text = "Esperando la primera lectura..."; json.Clear(); return; }
            var b = new StringBuilder();
            b.AppendLine($"Equipo: {i.ComputerName}");
            b.AppendLine($"Usuario de consola: {i.ConsoleUser ?? "Sin sesión o lectura no disponible"}");
            b.AppendLine($"Número de serie: {i.SerialNumber ?? "No disponible"}");
            b.AppendLine($"CPU: {(i.CpuModels.Length > 0 ? string.Join(", ", i.CpuModels) : "No disponible")}");
            b.AppendLine($"RAM instalada: {GiB(i.RamInstalledBytes)}");
            b.AppendLine(); b.AppendLine("ALMACENAMIENTO (volúmenes, no discos físicos)");
            foreach (var v in i.Volumes) b.AppendLine($"{v.Name} Total: {v.TotalBytes / 1073741824.0:F2} GiB | Libre: {v.FreeBytes / 1073741824.0:F2} GiB");
            b.AppendLine(); b.AppendLine($"Lectura: {i.CollectedAtUtc.ToLocalTime():g}");
            b.AppendLine($"ID captura: {i.InventoryId}");
            b.AppendLine($"ID equipo: {i.DeviceId}");
            b.AppendLine($"Último HTTP 2xx: {state.LastAcceptedAtUtc?.ToLocalTime().ToString("g") ?? "Nunca"}");
            b.AppendLine($"Captura aceptada: {state.LastAcceptedInventoryId?.ToString() ?? "Ninguna"}");
            foreach (var error in i.Errors) b.AppendLine($"Lectura parcial: {error}");
            summary.Text = b.ToString();
            json.Text = JsonSerializer.Serialize(i, Files.Json);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            status.Text = "No se pudo leer el estado del servicio. Comprueba instalación y permisos.";
            icon.Text = "GestioApp · servicio sin datos"
                + (activity?.Enabled == true ? " · medición ON" : " · medición OFF");
            summary.Text = "No hay una lectura disponible. El icono no ejecuta el inventario por sí solo.";
            json.Clear();
        }
    }
    protected override void ExitThreadCore()
    {
        activity?.Dispose();
        timer.Stop(); timer.Dispose(); icon.Visible = false; icon.Dispose(); menu.Dispose(); window.Dispose(); image.Dispose();
        base.ExitThreadCore();
    }
}
