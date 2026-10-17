using GestioApp.Agent;
using GestioApp.Contracts;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Text.Json;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(o => o.ServiceName = "GestioAppAgent");
var options = JsonSerializer.Deserialize<AgentOptions>(File.ReadAllText(Files.Config), Files.Json)
    ?? throw new InvalidOperationException("Configuración vacía.");
options.Validate();
builder.Services.AddSingleton(options);
builder.Services.AddSingleton<StateStore>();
builder.Services.AddSingleton<InventoryService>();
builder.Services.AddSingleton<ApiClient>();
builder.Services.AddHostedService<InventoryWorker>();
builder.Services.AddHostedService<HeartbeatWorker>();
builder.Services.AddHostedService<ActivityWorker>();
await builder.Build().RunAsync();
