using System.Text.Json;
namespace GestioApp.Contracts;

public sealed record ActivityBatch(int SchemaVersion, Guid BatchId, Guid CollectorId,
    int SessionId, DateTimeOffset StartedAtUtc, DateTimeOffset EndedAtUtc,
    double ActiveSeconds, double IdleSeconds, double LockedSeconds,
    double DisconnectedSeconds, double UnknownSeconds, int IdleThresholdSeconds)
{
    [System.Text.Json.Serialization.JsonIgnore]
    public double TotalSeconds => ActiveSeconds + IdleSeconds + LockedSeconds + DisconnectedSeconds + UnknownSeconds;
    public bool IsValid() => SchemaVersion == 1 && BatchId != Guid.Empty && CollectorId != Guid.Empty
        && SessionId >= 0 && IdleThresholdSeconds == 300 && EndedAtUtc >= StartedAtUtc
        && EndedAtUtc - StartedAtUtc <= TimeSpan.FromDays(7)
        && new[] { ActiveSeconds, IdleSeconds, LockedSeconds, DisconnectedSeconds, UnknownSeconds }
            .All(x => double.IsFinite(x) && x >= 0)
        && Math.Abs(TotalSeconds - (EndedAtUtc - StartedAtUtc).TotalSeconds) < 1;
}
public sealed record ActivityEnvelope(int SchemaVersion, Guid DeviceId, string UserSid,
    string UserName, DateTimeOffset ReceivedAtUtc, ActivityBatch Activity);

public static class ActivityProtocol
{
    public const string PipeName = "GestioApp.Activity.v1";
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static async Task WriteAsync<T>(Stream stream, T value, CancellationToken ct)
    {
        byte[] data = JsonSerializer.SerializeToUtf8Bytes(value, Json);
        if (data.Length > 16384) throw new InvalidDataException("Mensaje demasiado grande");
        await stream.WriteAsync(BitConverter.GetBytes(data.Length), ct);
        await stream.WriteAsync(data, ct);
        await stream.FlushAsync(ct);
    }
    public static async Task<T> ReadAsync<T>(Stream stream, CancellationToken ct)
    {
        byte[] header = new byte[4];
        await stream.ReadExactlyAsync(header, ct);
        int length = BitConverter.ToInt32(header);
        if (length is < 1 or > 16384) throw new InvalidDataException("Longitud inválida");
        byte[] data = new byte[length];
        await stream.ReadExactlyAsync(data, ct);
        return JsonSerializer.Deserialize<T>(data, Json) ?? throw new InvalidDataException("Mensaje vacío");
    }
    public static void SaveNew<T>(string path, T value)
    {
        string temp = path + ".tmp";
        using (var file = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            JsonSerializer.Serialize(file, value, Json);
            file.Flush(true);
        }
        File.Move(temp, path, false);
    }
}

public static class ActivityMath
{
    // Un cambio de estado o un hueco de muestreo no acredita actividad.
    public static int Bucket(string previous, string current, double seconds)
    {
        if (!double.IsFinite(seconds) || seconds <= 0 || seconds > 15 || previous != current) return 4;
        return current switch { "Active" => 0, "Idle" => 1, "Locked" => 2, "Disconnected" => 3, _ => 4 };
    }
}
