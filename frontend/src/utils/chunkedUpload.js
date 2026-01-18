/**
 * Utilidad para subir archivos por chunks (fragmentos)
 * Permite subir archivos grandes sin problemas de límites de PHP
 */

const CHUNK_SIZE = 1024 * 1024; // 1MB por chunk

export const uploadFileInChunks = async (file, uploadUrl, axiosInstance, onProgress) => {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const fileName = file.name || `file_${Date.now()}`;
  const fileId = `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  let uploadedBytes = 0;
  
  // Subir cada chunk
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('chunk_index', chunkIndex);
    formData.append('total_chunks', totalChunks);
    formData.append('file_id', fileId);
    formData.append('file_name', fileName);
    formData.append('file_size', file.size);
    formData.append('file_type', file.type);
    
    // Subir chunk
    try {
      await axiosInstance.post(uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000,
        onUploadProgress: (progressEvent) => {
          if (onProgress) {
            const chunkProgress = (progressEvent.loaded / progressEvent.total) * 100;
            const overallProgress = ((chunkIndex * CHUNK_SIZE + progressEvent.loaded) / file.size) * 100;
            onProgress(overallProgress);
          }
        }
      });
      
      uploadedBytes += (end - start);
      
    } catch (error) {
      console.error(`Error subiendo chunk ${chunkIndex}:`, error);
      throw new Error(`Error al subir el archivo (chunk ${chunkIndex + 1}/${totalChunks})`);
    }
  }
  
  // Cuando todos los chunks están subidos, decirle al servidor que combine los chunks
  return fileId;
};

/**
 * Función simplificada que decide automáticamente si usar chunks o subida normal
 */
export const smartUpload = async (file, uploadUrl, axiosInstance, onProgress) => {
  // Si el archivo es menor a 5MB, subir normalmente (más rápido)
  if (file.size < 5 * 1024 * 1024) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source_type', 'upload');
    
    return await axiosInstance.post(uploadUrl, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress);
        }
      }
    });
  }
  
  // Para archivos grandes, usar chunks
  const fileId = await uploadFileInChunks(file, `${uploadUrl}/chunk`, axiosInstance, onProgress);
  
  // Notificar al servidor que combine los chunks
  return await axiosInstance.post(`${uploadUrl}/complete`, {
    file_id: fileId,
    file_name: file.name,
    file_size: file.size,
    file_type: file.type,
    source_type: 'upload'
  });
};

