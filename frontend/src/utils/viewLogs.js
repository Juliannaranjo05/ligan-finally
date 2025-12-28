// Utilidad para ver logs de depuración
// Ejecutar en la consola del navegador: 
// import('/src/utils/viewLogs.js').then(m => m.viewAllLogs())

export function viewAllLogs() {
  console.log('=== LOGS DE REGISTRACIÓN ===');
  
  const lastLog = localStorage.getItem('last_registration_access_log');
  if (lastLog) {
    console.log('Último log exitoso:', JSON.parse(lastLog));
  }
  
  const lastError = localStorage.getItem('last_registration_access_error');
  if (lastError) {
    console.log('Último error getUser:', JSON.parse(lastError));
  }
  
  const generalError = localStorage.getItem('last_registration_access_general_error');
  if (generalError) {
    console.log('Último error general:', JSON.parse(generalError));
  }
  
  console.log('\n=== LOGS DE USER CACHE ===');
  const userCacheError = localStorage.getItem('last_userCache_error');
  if (userCacheError) {
    console.log('Último error userCache:', JSON.parse(userCacheError));
  }
  
  const userCacheLogs = localStorage.getItem('userCache_logs');
  if (userCacheLogs) {
    const logs = JSON.parse(userCacheLogs);
    console.log(`Total de logs: ${logs.length}`);
    console.log('Últimos 10 logs:', logs.slice(-10));
  }
}

export function clearAllLogs() {
  localStorage.removeItem('last_registration_access_log');
  localStorage.removeItem('last_registration_access_error');
  localStorage.removeItem('last_registration_access_general_error');
  localStorage.removeItem('last_userCache_error');
  localStorage.removeItem('userCache_logs');
  console.log('✅ Logs limpiados');
}

// Auto-ejecutar si se accede directamente
if (typeof window !== 'undefined') {
  window.viewRegistrationLogs = viewAllLogs;
  window.clearRegistrationLogs = clearAllLogs;
  console.log('💡 Ejecuta viewRegistrationLogs() o clearRegistrationLogs() en la consola');
}

