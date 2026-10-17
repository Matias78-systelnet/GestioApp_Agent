namespace GestioApp.Tray;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        // Evita abrir varias instancias en la misma sesión.
        using var mutex = new Mutex(
            true,
            @"Local\GestioApp.Tray",
            out bool primeraInstancia);

        if (!primeraInstancia)
            return;

        ApplicationConfiguration.Initialize();
        Application.Run(new TrayApplicationContext());
    }
}