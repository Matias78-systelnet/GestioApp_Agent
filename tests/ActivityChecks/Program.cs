using GestioApp.Contracts;
static void Check(bool ok, string test) { if (!ok) throw new Exception(test); Console.WriteLine("OK: " + test); }
Check(ActivityMath.Bucket("Active", "Active", 5) == 0, "Actividad estable");
Check(ActivityMath.Bucket("Active", "Locked", 5) == 4, "Transición no se atribuye como trabajo");
Check(ActivityMath.Bucket("Active", "Active", 3600) == 4, "Suspensión/hueco no suma actividad");
Check(ActivityMath.Bucket("Idle", "Idle", 5) == 1, "Inactividad");
Check(ActivityMath.Bucket("Locked", "Locked", 5) == 2, "Bloqueo");
Check(ActivityMath.Bucket("Disconnected", "Disconnected", 5) == 3, "Desconexión RDP");
var start = DateTimeOffset.UtcNow;
var batch = new ActivityBatch(1, Guid.NewGuid(), Guid.NewGuid(), 1, start, start.AddSeconds(60), 20, 10, 15, 5, 10, 300);
Check(batch.IsValid(), "Suma de categorías coincide con intervalo");
Check(!(batch with { ActiveSeconds = -1 }).IsValid(), "Rechaza duración negativa");
Check(!(batch with { ActiveSeconds = double.NaN }).IsValid(), "Rechaza NaN");
Check(!(batch with { EndedAtUtc = start.AddMinutes(2) }).IsValid(), "Rechaza suma inconsistente");
using var stream = new MemoryStream();
await ActivityProtocol.WriteAsync(stream, batch, CancellationToken.None);
stream.Position = 0;
Check(await ActivityProtocol.ReadAsync<ActivityBatch>(stream, CancellationToken.None) == batch, "Protocolo conserva lote e identidad");
using var invalid = new MemoryStream(BitConverter.GetBytes(20000));
bool rejected = false;
try { await ActivityProtocol.ReadAsync<ActivityBatch>(invalid, CancellationToken.None); } catch (InvalidDataException) { rejected = true; }
Check(rejected, "Limita mensaje antes de reservar memoria");
string folder = Path.Combine(Path.GetTempPath(), "GestioAppChecks-" + Guid.NewGuid());
Directory.CreateDirectory(folder);
try {
 string path = Path.Combine(folder, "batch.json");
 ActivityProtocol.SaveNew(path, batch);
 Check(File.Exists(path), "Persistencia antes de acuse");
 bool duplicate = false;
 try { ActivityProtocol.SaveNew(path, batch with { ActiveSeconds = 0 }); } catch (IOException) { duplicate = true; }
 Check(duplicate && System.Text.Json.JsonSerializer.Deserialize<ActivityBatch>(File.ReadAllText(path), ActivityProtocol.Json) == batch,
   "No sobrescribe lote existente");
} finally { Directory.Delete(folder, true); }
