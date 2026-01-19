<?php
/**
 * Configuración de límites de subida para videos de alta calidad
 * Estos valores se aplican al inicio de cada request de subida
 */

return [
    'upload_max_filesize' => '500M',
    'post_max_size' => '500M',
    'max_execution_time' => 300, // 5 minutos
    'memory_limit' => '512M',
];


