/* ═══ services/mock-data.js — Datos semilla del modo 'mock' ═══
 * Tienen la misma forma que debe devolver el backend (ver docs/API.md).
 * No se usan en modo 'http'.
 */

const MockData = (() => {
  // Fecha ISO relativa a hoy: at(0, 8, 32) = hoy 08:32 ; at(1, 17, 45) = ayer 17:45
  const at = (daysAgo, h, m) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const users = () => [
    { id: 1, name: 'María González', rut: '12.345.678-5', email: 'm.gonzalez@empresa.cl', role: 'Usuario', area: 'RRHH', status: 'active', assetCount: 1, lastAccess: at(0, 8, 32), avgConnectionMin: 380 },
    { id: 2, name: 'Carlos Muñoz', rut: '13.456.789-9', email: 'c.munoz@empresa.cl', role: 'Supervisor', area: 'Contabilidad', status: 'active', assetCount: 1, lastAccess: at(0, 9, 15), avgConnectionMin: 425 },
    { id: 3, name: 'Juan Rojas', rut: '14.567.890-0', email: 'j.rojas@empresa.cl', role: 'Usuario', area: 'Operaciones', status: 'active', assetCount: 2, lastAccess: at(1, 17, 45), avgConnectionMin: 340 },
    { id: 4, name: 'Admin Rodrigo', rut: '15.678.901-1', email: 'admin@empresa.cl', role: 'Administrador', area: 'Informática', status: 'active', assetCount: 2, lastAccess: at(0, 10, 17), avgConnectionMin: 490 },
    { id: 5, name: 'Carlos Fuentes Morales', rut: '16.789.012-1', email: 'c.fuentes@empresa.cl', role: 'Usuario', area: 'Soporte TI', status: 'active', assetCount: 1, lastAccess: at(0, 8, 5), avgConnectionMin: 455 },
  ];

  const assets = () => [
    { id: 1, name: 'Notebook Dell Latitude 5540', type: 'Notebook', serial: 'DL5540-2024-001', status: 'Asignado', location: 'Casa Matriz', value: 850000, assignedTo: { id: 1, name: 'María González' } },
    { id: 2, name: 'PC Desktop HP ProDesk 400', type: 'PC', serial: 'HP-PD400-2024-002', status: 'Asignado', location: 'Casa Matriz', value: 620000, assignedTo: { id: 2, name: 'Carlos Muñoz' } },
    { id: 3, name: 'Notebook Lenovo ThinkPad T14', type: 'Notebook', serial: 'LN-T14-2024-003', status: 'Disponible', location: 'Bodega', value: 780000, assignedTo: null },
    { id: 4, name: 'PC Desktop Lenovo M70q', type: 'PC', serial: 'LN-M70Q-2024-004', status: 'Asignado', location: 'Sucursal 2', value: 450000, assignedTo: { id: 3, name: 'Juan Rojas' } },
    { id: 5, name: 'Notebook HP ProBook 440 G10', type: 'Notebook', serial: 'HP-PB440-2024-005', status: 'Asignado', location: 'Sucursal 3', value: 650000, assignedTo: { id: 3, name: 'Juan Rojas' } },
    { id: 6, name: 'PC Desktop HP EliteDesk 800', type: 'PC', serial: 'HP-ED800-2023-006', status: 'Asignado', location: 'Casa Matriz', value: 720000, assignedTo: { id: 4, name: 'Admin Rodrigo' } },
    { id: 7, name: 'Notebook HP 240 G10', type: 'Notebook', serial: 'HP-240G10-2024-007', status: 'Disponible', location: 'Bodega', value: 499990, assignedTo: null },
    { id: 8, name: 'Notebook Dell Latitude 3540', type: 'Notebook', serial: 'DL3540-2024-008', status: 'Asignado', location: 'Casa Matriz', value: 550000, assignedTo: { id: 4, name: 'Admin Rodrigo' } },
    /* Activo con ficha técnica completa (Hardware Asset Card).
       Campos opcionales del contrato Asset: assetTag, brand, model, segment, condition, specs, warrantyPlan,
       warrantyUntil (AAAA-MM-DD) y assignedTo.area / floor. El resto de la app solo usa los campos base. */
    {
      id: 'AST-2026-014',
      assetTag: 'NB-TI-014',
      name: 'Notebook Dell Latitude 5440',
      brand: 'Dell',
      model: 'Latitude 5440',
      segment: 'Empresarial',
      type: 'Notebook',
      serial: '8X9K2Z3',
      status: 'Asignado',          // asignación: Asignado | Disponible
      condition: 'Operativo',      // condición operativa: Operativo | En reparación | De baja
      location: 'Edificio Central',
      floor: 'Piso 3',
      value: null,
      assignedTo: { id: 5, name: 'Carlos Fuentes Morales', area: 'Soporte TI' },
      specs: {
        cpu: 'Intel® Core™ i5-1335U',
        cpuDetail: '10 núcleos · hasta 4.60 GHz',
        ram: '16 GB DDR4',
        ramDetail: '3200 MT/s',
        storage: '512 GB SSD',
        storageDetail: 'M.2 PCIe NVMe Gen4',
        display: '14.0" FHD (1920×1080) WVA antirreflejo',
        os: 'Windows 11 Pro 64-bit',
      },
      warrantyPlan: 'Dell ProSupport Onsite',
      warrantyUntil: '2027-04-10',
    },
  ];

  // Respaldo automático cada 30 minutos: último = última marca :00/:30, próximo = +30 min
  const backups = () => {
    const last = new Date();
    last.setMinutes(last.getMinutes() < 30 ? 0 : 30, 0, 0);
    const next = new Date(last.getTime() + 30 * 60000);
    return backupsData(last.toISOString(), next.toISOString());
  };

  const backupsData = (lastRun, nextRun) => ({
    active: true,
    intervalMin: 30,
    lastRun,
    nextRun,
    folders: [
      { name: 'Documentos', files: 42, size: '1.8 GB' },
      { name: 'Correos', files: 1, size: '890 MB' },
      { name: 'Configuraciones', files: 8, size: '156 KB' },
    ],
    files: [
      { name: 'Informe_Mensual_Sept.docx', folder: 'Documentos/Informes', size: '2.1 MB', modifiedAt: at(0, 9, 45), url: null },
      { name: 'Planilla_Asistencia.xlsx', folder: 'Documentos/RRHH', size: '845 KB', modifiedAt: at(0, 8, 30), url: null },
      { name: 'Contrato_Proveedor_2026.pdf', folder: 'Documentos/Contratos', size: '3.4 MB', modifiedAt: at(1, 16, 20), url: null },
      { name: 'Presupuesto_Q4.xlsx', folder: 'Documentos/Finanzas', size: '1.2 MB', modifiedAt: at(1, 14, 10), url: null },
      { name: 'Correo_Backup_Outlook.pst', folder: 'Correos', size: '890 MB', modifiedAt: at(0, 3, 0), url: null },
      { name: 'Config_VPN_Perfil.ovpn', folder: 'Configuraciones', size: '12 KB', modifiedAt: at(7, 11, 30), url: null },
      { name: 'Plano_Estructura_Nave3.dwg', folder: 'Documentos/Planos', size: '18.5 MB', modifiedAt: at(8, 9, 15), url: null },
      { name: 'Fotos_Faena_Copiapo.zip', folder: 'Documentos/Fotos', size: '245 MB', modifiedAt: at(9, 17, 0), url: null },
    ],
  });

  return { users, assets, backups };
})();
