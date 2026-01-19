<?php
/**
 * Script para verificar los límites actuales de PHP-FPM
 * Accede a: https://ligandome.com/check_php_fpm_limits.php
 */
header('Content-Type: application/json');

echo json_encode([
    'upload_max_filesize' => ini_get('upload_max_filesize'),
    'post_max_size' => ini_get('post_max_size'),
    'max_execution_time' => ini_get('max_execution_time'),
    'memory_limit' => ini_get('memory_limit'),
    'max_input_time' => ini_get('max_input_time'),
    'php_version' => phpversion(),
    'sapi_name' => php_sapi_name(),
], JSON_PRETTY_PRINT);


