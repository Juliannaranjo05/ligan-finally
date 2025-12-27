<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class BackupDatabase extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'db:backup {--compress : Compress the backup file}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a backup of the database';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $this->info('🔄 Iniciando backup de base de datos...');

        try {
            $connection = config('database.default');
            $config = config("database.connections.{$connection}");

            if ($config['driver'] !== 'mysql') {
                $this->error('❌ Solo se soporta MySQL actualmente');
                return 1;
            }

            // Crear directorio de backups si no existe
            $backupDir = storage_path('app/backups');
            if (!file_exists($backupDir)) {
                mkdir($backupDir, 0755, true);
            }

            // Nombre del archivo de backup
            $timestamp = Carbon::now()->format('Y-m-d_H-i-s');
            $filename = "backup_{$timestamp}.sql";
            $filepath = "{$backupDir}/{$filename}";

            // Comando mysqldump
            $host = escapeshellarg($config['host']);
            $port = escapeshellarg($config['port']);
            $database = escapeshellarg($config['database']);
            $username = escapeshellarg($config['username']);
            $password = escapeshellarg($config['password']);

            // Construir comando mysqldump
            $command = sprintf(
                'mysqldump -h %s -P %s -u %s -p%s %s > %s 2>&1',
                $host,
                $port,
                $username,
                $password,
                $database,
                escapeshellarg($filepath)
            );

            // Ejecutar backup
            exec($command, $output, $returnCode);

            if ($returnCode !== 0) {
                $this->error('❌ Error al crear backup');
                $this->error(implode("\n", $output));
                Log::error('Error en backup de base de datos', [
                    'return_code' => $returnCode,
                    'output' => $output
                ]);
                return 1;
            }

            // Verificar que el archivo se creó
            if (!file_exists($filepath) || filesize($filepath) === 0) {
                $this->error('❌ El archivo de backup está vacío o no se creó');
                return 1;
            }

            $fileSize = filesize($filepath);
            $this->info("✅ Backup creado: {$filename} ({$this->formatBytes($fileSize)})");

            // Comprimir si se solicita
            if ($this->option('compress')) {
                $compressedPath = "{$filepath}.gz";
                $gz = gzopen($compressedPath, 'w9');
                $file = fopen($filepath, 'r');
                
                while (!feof($file)) {
                    gzwrite($gz, fread($file, 8192));
                }
                
                fclose($file);
                gzclose($gz);
                
                // Eliminar archivo original
                unlink($filepath);
                
                $compressedSize = filesize($compressedPath);
                $this->info("✅ Backup comprimido: {$filename}.gz ({$this->formatBytes($compressedSize)})");
            }

            // Limpiar backups antiguos (mantener últimos 7 días)
            $this->cleanOldBackups($backupDir);

            Log::info('Backup de base de datos completado', [
                'filename' => $filename,
                'size' => $fileSize,
                'compressed' => $this->option('compress')
            ]);

            return 0;

        } catch (\Exception $e) {
            $this->error('❌ Error: ' . $e->getMessage());
            Log::error('Error en comando de backup', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return 1;
        }
    }

    /**
     * Limpiar backups antiguos (más de 7 días)
     */
    private function cleanOldBackups($backupDir)
    {
        $files = glob("{$backupDir}/backup_*.sql*");
        $cutoffDate = Carbon::now()->subDays(7);
        $deletedCount = 0;

        foreach ($files as $file) {
            $fileTime = Carbon::createFromTimestamp(filemtime($file));
            if ($fileTime->lt($cutoffDate)) {
                unlink($file);
                $deletedCount++;
            }
        }

        if ($deletedCount > 0) {
            $this->info("🗑️  Eliminados {$deletedCount} backups antiguos");
        }
    }

    /**
     * Formatear bytes a formato legible
     */
    private function formatBytes($bytes, $precision = 2)
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }
        
        return round($bytes, $precision) . ' ' . $units[$i];
    }
}
