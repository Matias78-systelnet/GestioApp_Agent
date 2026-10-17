using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
namespace GestioApp.Tray;

// Una ventana invisible recibe únicamente eventos de su propia sesión.
internal sealed class SessionProbe : NativeWindow, IDisposable
{
    private bool? locked;
    public int SessionId { get; } = Process.GetCurrentProcess().SessionId;
    public SessionProbe()
    {
        CreateHandle(new CreateParams { Caption = "GestioApp Session Events" });
        if (!WTSRegisterSessionNotification(Handle, 0))
        {
            DestroyHandle();
            throw new InvalidOperationException("No se pudo registrar eventos de sesión");
        }
    }
    protected override void WndProc(ref Message m)
    {
        if (m.Msg == 0x02B1)
        {
            int reason = m.WParam.ToInt32();
            if (reason == 7) locked = true;
            if (reason == 8) locked = false;
        }
        base.WndProc(ref m);
    }
    public string Read()
    {
        if (!WTSQuerySessionInformation(IntPtr.Zero, SessionId, 8, out var buffer, out int bytes)) return "Unknown";
        int connection;
        try { if (bytes < 4) return "Unknown"; connection = Marshal.ReadInt32(buffer); }
        finally { WTSFreeMemory(buffer); }
        if (connection == 4) return "Disconnected";
        if (connection != 0) return "Unknown";
        if (locked == true) return "Locked";
        // UAC, escritorio seguro o acceso denegado: desconocido, nunca actividad inventada.
        var desktop = OpenInputDesktop(0, false, 1);
        if (desktop == IntPtr.Zero) return "Unknown";
        try
        {
            var name = new StringBuilder(256);
            if (!GetUserObjectInformation(desktop, 2, name, name.Capacity * 2, out _) || name.ToString() != "Default")
                return "Unknown";
        }
        finally { CloseDesktop(desktop); }
        var input = new LASTINPUTINFO { cbSize = (uint)Marshal.SizeOf<LASTINPUTINFO>() };
        if (!GetLastInputInfo(ref input)) return "Unknown";
        uint idle = unchecked((uint)Environment.TickCount - input.dwTime);
        return idle >= 300000 ? "Idle" : "Active";
    }
    public void Dispose() { WTSUnRegisterSessionNotification(Handle); DestroyHandle(); }
    [StructLayout(LayoutKind.Sequential)] private struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
    [DllImport("user32.dll")] private static extern bool GetLastInputInfo(ref LASTINPUTINFO info);
    [DllImport("user32.dll")] private static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
    [DllImport("user32.dll")] private static extern bool CloseDesktop(IntPtr desktop);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "GetUserObjectInformationW")]
    private static extern bool GetUserObjectInformation(IntPtr obj, int index, StringBuilder info, int length, out int needed);
    [DllImport("wtsapi32.dll")] private static extern bool WTSRegisterSessionNotification(IntPtr window, uint flags);
    [DllImport("wtsapi32.dll")] private static extern bool WTSUnRegisterSessionNotification(IntPtr window);
    [DllImport("wtsapi32.dll", EntryPoint = "WTSQuerySessionInformationW")]
    private static extern bool WTSQuerySessionInformation(IntPtr server, int session, int info, out IntPtr buffer, out int bytes);
    [DllImport("wtsapi32.dll")] private static extern void WTSFreeMemory(IntPtr memory);
}
