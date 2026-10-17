#:package System.Management@10.0.10
#:property PublishAot=false
#:property BuiltInComInteropSupport=true

using System;
using System.Collections.Generic;
using System.IO;
using System.Management;

if (!OperatingSystem.IsWindows())
{
    Console.WriteLine("Este programa requiere Windows.");
    return;
}

// Consulta una propiedad WMI y devuelve todos sus valores.
static List<string> ConsultarWmi(string clase, string propiedad)
{
    var valores = new List<string>();

    try
    {
        using var consulta = new ManagementObjectSearcher(
            $"SELECT {propiedad} FROM {clase}");

        using var resultados = consulta.Get();

        foreach (ManagementObject objeto in resultados)
        {
            using (objeto)
            {
                string? valor = objeto[propiedad]?.ToString()?.Trim();

                if (!string.IsNullOrWhiteSpace(valor))
                    valores.Add(valor);
            }
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine(
            $"No se pudo consultar {clase}: {ex.Message}");
    }

    return valores;
}

static string MostrarValores(List<string> valores)
{
    return valores.Count > 0
        ? string.Join(", ", valores)
        : "No disponible";
}

// Convierte bytes a GiB.
static double EnGiB(double bytes)
{
    return bytes / (1024 * 1024 * 1024);
}

Console.WriteLine("=== INVENTARIO GESTIOAPP ===");
Console.WriteLine($"Equipo: {Environment.MachineName}");
Console.WriteLine($"Fecha UTC: {DateTimeOffset.UtcNow:O}");

Console.WriteLine(
    $"Serie: {MostrarValores(ConsultarWmi("Win32_BIOS", "SerialNumber"))}");

Console.WriteLine(
    $"Modelo: {MostrarValores(ConsultarWmi("Win32_ComputerSystem", "Model"))}");

Console.WriteLine(
    $"Procesador: {MostrarValores(ConsultarWmi("Win32_Processor", "Name"))}");

// RAM física instalada.
var capacidades = ConsultarWmi("Win32_PhysicalMemory", "Capacity");
ulong ramBytes = 0;
bool ramCompleta = capacidades.Count > 0;

foreach (string capacidad in capacidades)
{
    if (ulong.TryParse(capacidad, out ulong bytes))
        ramBytes += bytes;
    else
        ramCompleta = false;
}

Console.WriteLine(ramCompleta
    ? $"RAM instalada: {EnGiB(ramBytes):F2} GiB"
    : "RAM instalada: No disponible");

// Volúmenes fijos accesibles, como C: y D:.
Console.WriteLine("\n=== ALMACENAMIENTO POR UNIDAD ===");

foreach (DriveInfo unidad in DriveInfo.GetDrives())
{
    try
    {
        if (unidad.DriveType != DriveType.Fixed || !unidad.IsReady)
            continue;

        Console.WriteLine($"\nUnidad: {unidad.Name}");
        Console.WriteLine($"Total: {EnGiB(unidad.TotalSize):F2} GiB");
        Console.WriteLine(
            $"Disponible: {EnGiB(unidad.AvailableFreeSpace):F2} GiB");
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine(
            $"No se pudo leer {unidad.Name}: {ex.Message}");
    }
}