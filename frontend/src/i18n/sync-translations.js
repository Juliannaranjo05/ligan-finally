const fs = require('fs');
const path = require('path');

// Función para merge profundo de objetos
function deepMerge(target, source) {
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

// Función para agregar claves faltantes manteniendo valores existentes
function syncKeys(reference, target) {
  const result = { ...target };
  
  for (const key in reference) {
    if (!(key in result)) {
      // Si la clave no existe, copiar la estructura del reference
      if (isObject(reference[key])) {
        result[key] = syncKeys(reference[key], {});
      } else {
        // Para valores primitivos, usar el valor del reference como placeholder
        result[key] = reference[key];
      }
    } else if (isObject(reference[key]) && isObject(result[key])) {
      // Si ambos son objetos, hacer merge recursivo
      result[key] = syncKeys(reference[key], result[key]);
    }
    // Si existe y no es objeto, mantener el valor existente
  }
  
  return result;
}

// Leer el archivo de referencia
const localesDir = path.join(__dirname, 'locales');
const referencePath = path.join(localesDir, 'en.json');
const reference = JSON.parse(fs.readFileSync(referencePath, 'utf8'));

// Obtener todos los archivos JSON excepto en.json
const files = fs.readdirSync(localesDir)
  .filter(file => file.endsWith('.json') && file !== 'en.json')
  .sort();

console.log(`Sincronizando ${files.length} archivos con en.json...\n`);

files.forEach(file => {
  const filePath = path.join(localesDir, file);
  try {
    const target = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const synced = syncKeys(reference, target);
    
    // Guardar el archivo sincronizado con formato bonito
    fs.writeFileSync(
      filePath,
      JSON.stringify(synced, null, 2) + '\n',
      'utf8'
    );
    
    // Contar claves agregadas (aproximado)
    const refKeys = Object.keys(reference).length;
    const targetKeys = Object.keys(target).length;
    const syncedKeys = Object.keys(synced).length;
    
    console.log(`✓ ${file}: ${syncedKeys - targetKeys} claves agregadas (total: ${syncedKeys})`);
  } catch (error) {
    console.error(`✗ Error procesando ${file}:`, error.message);
  }
});

console.log('\n✓ Sincronización completada!');

