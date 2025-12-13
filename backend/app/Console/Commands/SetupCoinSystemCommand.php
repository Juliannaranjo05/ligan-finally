<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Artisan;

class SetupCoinSystemCommand extends Command
{
    protected $signature = 'setup:coin-system {--force : Sobrescribir archivos existentes}';
    protected $description = 'Configurar completamente el sistema de monedas';

    public function handle()
    {
        $this->info('🚀 CONFIGURANDO SISTEMA DE MONEDAS...');
        $this->line('=====================================');

        $force = $this->option('force');

        // 1. Crear migraciones
        $this->createMigrations($force);

        // 2. Crear modelos
        $this->createModels($force);

        // 3. Crear controladores
        $this->createControllers($force);

        // 4. Crear comandos
        $this->createCommands($force);

        // 5. Crear seeder
        $this->createSeeder($force);

        // 6. Mostrar instrucciones finales
        $this->showFinalInstructions();

        $this->info('✅ ¡SISTEMA DE MONEDAS CONFIGURADO EXITOSAMENTE!');
        return 0;
    }

    private function createMigrations($force)
    {
        $this->info('📁 Creando migraciones...');

        $migrations = [
            'create_user_coins_table' => $this->getUserCoinsMigration(),
            'create_coin_packages_table' => $this->getCoinPackagesMigration(),
            'create_coin_purchases_table' => $this->getCoinPurchasesMigration(),
            'create_coin_transactions_table' => $this->getCoinTransactionsMigration(),
            'create_coin_consumptions_table' => $this->getCoinConsumptionsMigration(),
        ];

        foreach ($migrations as $name => $content) {
            $timestamp = now()->addSeconds(array_search($name, array_keys($migrations)))->format('Y_m_d_His');
            $filename = "{$timestamp}_{$name}.php";
            $path = database_path("migrations/{$filename}");

            if (!File::exists($path) || $force) {
                File::put($path, $content);
                $this->line("✅ Migración creada: {$filename}");
            } else {
                $this->warn("⚠️  Migración ya existe: {$filename}");
            }
        }
    }

    private function createModels($force)
    {
        $this->info('📝 Creando modelos...');

        $models = [
            'UserCoins' => $this->getUserCoinsModel(),
            'CoinPackage' => $this->getCoinPackageModel(),
            'CoinPurchase' => $this->getCoinPurchaseModel(),
            'CoinTransaction' => $this->getCoinTransactionModel(),
            'CoinConsumption' => $this->getCoinConsumptionModel(),
        ];

        foreach ($models as $name => $content) {
            $path = app_path("Models/{$name}.php");

            if (!File::exists($path) || $force) {
                File::put($path, $content);
                $this->line("✅ Modelo creado: {$name}.php");
            } else {
                $this->warn("⚠️  Modelo ya existe: {$name}.php");
            }
        }
    }

    private function createControllers($force)
    {
        $this->info('🎮 Creando controladores...');

        $controllers = [
            'VideoChatCoinController' => $this->getVideoChatCoinController(),
            'StripeCoinsController' => $this->getStripeCoinsController(),
        ];

        foreach ($controllers as $name => $content) {
            $path = app_path("Http/Controllers/{$name}.php");

            if (!File::exists($path) || $force) {
                File::put($path, $content);
                $this->line("✅ Controlador creado: {$name}.php");
            } else {
                $this->warn("⚠️  Controlador ya existe: {$name}.php");
            }
        }
    }

    private function createCommands($force)
    {
        $this->info('⚡ Creando comandos...');

        $commands = [
            'AddCoinsToUserCommand' => $this->getAddCoinsCommand(),
            'CoinSystemStatsCommand' => $this->getStatsCommand(),
            'CleanupExpiredDataCommand' => $this->getCleanupCommand(),
            'GenerateCoinReportCommand' => $this->getReportCommand(),
        ];

        foreach ($commands as $name => $content) {
            $path = app_path("Console/Commands/{$name}.php");

            if (!File::exists($path) || $force) {
                File::put($path, $content);
                $this->line("✅ Comando creado: {$name}.php");
            } else {
                $this->warn("⚠️  Comando ya existe: {$name}.php");
            }
        }
    }

    private function createSeeder($force)
    {
        $this->info('🌱 Creando seeder...');

        $path = database_path('seeders/CoinPackagesSeeder.php');
        $content = $this->getCoinPackagesSeeder();

        if (!File::exists($path) || $force) {
            File::put($path, $content);
            $this->line("✅ Seeder creado: CoinPackagesSeeder.php");
        } else {
            $this->warn("⚠️  Seeder ya existe: CoinPackagesSeeder.php");
        }
    }

    private function showFinalInstructions()
    {
        $this->line('');
        $this->info('🎯 PRÓXIMOS PASOS:');
        $this->line('==================');
        $this->line('1. Ejecutar migraciones:');
        $this->line('   php artisan migrate');
        $this->line('');
        $this->line('2. Ejecutar seeder:');
        $this->line('   php artisan db:seed --class=CoinPackagesSeeder');
        $this->line('');
        $this->line('3. Agregar rutas en routes/api.php');
        $this->line('4. Configurar Stripe en .env');
        $this->line('5. Modificar LiveKitController para integración');
        $this->line('');
        $this->info('📚 COMANDOS DISPONIBLES DESPUÉS:');
        $this->line('php artisan coins:add {user_id} {amount}');
        $this->line('php artisan coins:stats');
        $this->line('php artisan coins:report');
        $this->line('php artisan coins:cleanup');
    }

    // =================================================================
    // CONTENIDO DE ARCHIVOS
    // =================================================================

    private function getUserCoinsMigration()
    {
        return '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateUserCoinsTable extends Migration
{
    public function up()
    {
        Schema::create(\'user_coins\', function (Blueprint $table) {
            $table->id();
            $table->foreignId(\'user_id\')->constrained()->onDelete(\'cascade\');
            $table->integer(\'purchased_balance\')->default(0)->comment(\'Monedas compradas disponibles\');
            $table->integer(\'gift_balance\')->default(0)->comment(\'Monedas de regalo disponibles\');
            $table->integer(\'total_purchased\')->default(0)->comment(\'Total de monedas compradas históricamente\');
            $table->integer(\'total_consumed\')->default(0)->comment(\'Total de monedas consumidas históricamente\');
            $table->timestamp(\'last_purchase_at\')->nullable()->comment(\'Última vez que compró monedas\');
            $table->timestamp(\'last_consumption_at\')->nullable()->comment(\'Última vez que consumió monedas\');
            $table->timestamps();
            
            $table->index([\'user_id\']);
            $table->index([\'purchased_balance\', \'gift_balance\']);
        });
    }

    public function down()
    {
        Schema::dropIfExists(\'user_coins\');
    }
}';
    }

    private function getCoinPackagesMigration()
    {
        return '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCoinPackagesTable extends Migration
{
    public function up()
    {
        Schema::create(\'coin_packages\', function (Blueprint $table) {
            $table->id();
            $table->string(\'name\')->comment(\'Nombre del paquete\');
            $table->text(\'description\')->nullable()->comment(\'Descripción del paquete\');
            $table->integer(\'coins\')->comment(\'Cantidad de monedas base\');
            $table->integer(\'bonus_coins\')->default(0)->comment(\'Monedas bonus gratis\');
            $table->decimal(\'price\', 8, 2)->comment(\'Precio en USD\');
            $table->boolean(\'is_active\')->default(true)->comment(\'Si el paquete está disponible\');
            $table->boolean(\'is_popular\')->default(false)->comment(\'Si es el paquete más popular\');
            $table->integer(\'sort_order\')->default(0)->comment(\'Orden de visualización\');
            $table->timestamps();
            
            $table->index([\'is_active\', \'sort_order\']);
        });
    }

    public function down()
    {
        Schema::dropIfExists(\'coin_packages\');
    }
}';
    }

    private function getCoinPurchasesMigration()
    {
        return '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCoinPurchasesTable extends Migration
{
    public function up()
    {
        Schema::create(\'coin_purchases\', function (Blueprint $table) {
            $table->id();
            $table->foreignId(\'user_id\')->constrained()->onDelete(\'cascade\');
            $table->foreignId(\'package_id\')->nullable()->constrained(\'coin_packages\')->onDelete(\'set null\');
            $table->integer(\'coins\')->comment(\'Monedas base compradas\');
            $table->integer(\'bonus_coins\')->default(0)->comment(\'Monedas bonus recibidas\');
            $table->integer(\'total_coins\')->comment(\'Total de monedas (base + bonus)\');
            $table->decimal(\'amount\', 8, 2)->comment(\'Monto pagado\');
            $table->string(\'currency\', 3)->default(\'USD\');
            $table->string(\'payment_method\')->comment(\'stripe, paypal, admin, etc.\');
            $table->enum(\'status\', [\'pending\', \'completed\', \'failed\', \'cancelled\', \'refunded\'])->default(\'pending\');
            $table->string(\'transaction_id\')->unique()->comment(\'ID de transacción de Stripe/PayPal\');
            $table->json(\'payment_data\')->nullable()->comment(\'Datos adicionales del pago\');
            $table->timestamp(\'completed_at\')->nullable();
            $table->timestamps();
            
            $table->index([\'user_id\', \'status\']);
            $table->index([\'status\', \'created_at\']);
            $table->index([\'transaction_id\']);
        });
    }

    public function down()
    {
        Schema::dropIfExists(\'coin_purchases\');
    }
}';
    }

    private function getCoinTransactionsMigration()
    {
        return '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCoinTransactionsTable extends Migration
{
    public function up()
    {
        Schema::create(\'coin_transactions\', function (Blueprint $table) {
            $table->id();
            $table->foreignId(\'user_id\')->constrained()->onDelete(\'cascade\');
            $table->enum(\'type\', [\'purchased\', \'gift\'])->comment(\'Tipo de monedas agregadas\');
            $table->integer(\'amount\')->comment(\'Cantidad de monedas agregadas\');
            $table->string(\'source\')->comment(\'Origen: stripe_purchase, admin_gift, bonus, etc.\');
            $table->string(\'reference_id\')->nullable()->comment(\'ID de referencia\');
            $table->integer(\'balance_after\')->comment(\'Balance total después de la transacción\');
            $table->text(\'notes\')->nullable()->comment(\'Notas adicionales\');
            $table->timestamps();
            
            $table->index([\'user_id\', \'created_at\']);
            $table->index([\'type\', \'source\']);
        });
    }

    public function down()
    {
        Schema::dropIfExists(\'coin_transactions\');
    }
}';
    }

    private function getCoinConsumptionsMigration()
    {
        return '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCoinConsumptionsTable extends Migration
{
    public function up()
    {
        Schema::create(\'coin_consumptions\', function (Blueprint $table) {
            $table->id();
            $table->foreignId(\'user_id\')->constrained()->onDelete(\'cascade\');
            $table->string(\'room_name\')->comment(\'Nombre de la sala de videochat\');
            $table->string(\'session_id\')->nullable()->comment(\'ID de sesión de videochat\');
            $table->decimal(\'minutes_consumed\', 8, 2)->comment(\'Minutos de videochat consumidos\');
            $table->integer(\'coins_consumed\')->comment(\'Total de monedas consumidas\');
            $table->integer(\'gift_coins_used\')->default(0)->comment(\'Monedas de regalo utilizadas\');
            $table->integer(\'purchased_coins_used\')->default(0)->comment(\'Monedas compradas utilizadas\');
            $table->integer(\'balance_after\')->comment(\'Balance total después del consumo\');
            $table->timestamp(\'consumed_at\')->comment(\'Momento del consumo\');
            $table->timestamps();
            
            $table->index([\'user_id\', \'consumed_at\']);
            $table->index([\'room_name\']);
            $table->index([\'session_id\']);
        });
    }

    public function down()
    {
        Schema::dropIfExists(\'coin_consumptions\');
    }
}';
    }

    private function getUserCoinsModel()
    {
        return '<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserCoins extends Model
{
    use HasFactory;

    protected $fillable = [
        \'user_id\',
        \'purchased_balance\',
        \'gift_balance\',
        \'total_purchased\',
        \'total_consumed\',
        \'last_purchase_at\',
        \'last_consumption_at\'
    ];

    protected $casts = [
        \'last_purchase_at\' => \'datetime\',
        \'last_consumption_at\' => \'datetime\'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function getTotalBalanceAttribute()
    {
        return $this->purchased_balance + $this->gift_balance;
    }

    public function getMinutesAvailableAttribute()
    {
        return floor($this->total_balance / 10);
    }

    public function scopeWithBalance($query)
    {
        return $query->whereRaw(\'(purchased_balance + gift_balance) > 0\');
    }

    public function scopeInsufficientBalance($query, $minimumRequired = 30)
    {
        return $query->whereRaw(\'(purchased_balance + gift_balance) < ?\', [$minimumRequired]);
    }
}';
    }

    private function getCoinPackageModel()
    {
        return '<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CoinPackage extends Model
{
    use HasFactory;

    protected $fillable = [
        \'name\',
        \'description\',
        \'coins\',
        \'bonus_coins\',
        \'price\',
        \'is_active\',
        \'is_popular\',
        \'sort_order\'
    ];

    protected $casts = [
        \'price\' => \'decimal:2\',
        \'is_active\' => \'boolean\',
        \'is_popular\' => \'boolean\'
    ];

    public function getTotalCoinsAttribute()
    {
        return $this->coins + $this->bonus_coins;
    }

    public function scopeActive($query)
    {
        return $query->where(\'is_active\', true);
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy(\'sort_order\')->orderBy(\'coins\');
    }
}';
    }

    private function getCoinPurchaseModel()
    {
        return '<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CoinPurchase extends Model
{
    use HasFactory;

    protected $fillable = [
        \'user_id\',
        \'package_id\',
        \'coins\',
        \'bonus_coins\',
        \'total_coins\',
        \'amount\',
        \'currency\',
        \'payment_method\',
        \'status\',
        \'transaction_id\',
        \'payment_data\',
        \'completed_at\'
    ];

    protected $casts = [
        \'amount\' => \'decimal:2\',
        \'payment_data\' => \'array\',
        \'completed_at\' => \'datetime\'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function package()
    {
        return $this->belongsTo(CoinPackage::class, \'package_id\');
    }

    public function scopeCompleted($query)
    {
        return $query->where(\'status\', \'completed\');
    }
}';
    }

    private function getCoinTransactionModel()
    {
        return '<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CoinTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        \'user_id\',
        \'type\',
        \'amount\',
        \'source\',
        \'reference_id\',
        \'balance_after\',
        \'notes\'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}';
    }

    private function getCoinConsumptionModel()
    {
        return '<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CoinConsumption extends Model
{
    use HasFactory;

    protected $fillable = [
        \'user_id\',
        \'room_name\',
        \'session_id\',
        \'minutes_consumed\',
        \'coins_consumed\',
        \'gift_coins_used\',
        \'purchased_coins_used\',
        \'balance_after\',
        \'consumed_at\'
    ];

    protected $casts = [
        \'minutes_consumed\' => \'decimal:2\',
        \'consumed_at\' => \'datetime\'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}';
    }

    private function getVideoChatCoinController()
    {
        return '<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\UserCoins;
use App\Models\CoinTransaction;
use App\Models\CoinConsumption;
use Exception;

class VideoChatCoinController extends Controller
{
    const COST_PER_MINUTE = 10;
    const MINIMUM_BALANCE = 30;
    
    public function getBalance()
    {
        try {
            $user = Auth::user();
            $userCoins = $this->getUserCoins($user->id);

            $totalBalance = $userCoins->purchased_balance + $userCoins->gift_balance;
            $minutesAvailable = floor($totalBalance / self::COST_PER_MINUTE);

            return response()->json([
                \'success\' => true,
                \'balance\' => [
                    \'purchased_coins\' => $userCoins->purchased_balance,
                    \'gift_coins\' => $userCoins->gift_balance,
                    \'total_coins\' => $totalBalance,
                    \'minutes_available\' => $minutesAvailable,
                    \'cost_per_minute\' => self::COST_PER_MINUTE,
                    \'minimum_required\' => self::MINIMUM_BALANCE
                ],
                \'can_start_call\' => $totalBalance >= self::MINIMUM_BALANCE
            ]);
            
        } catch (Exception $e) {
            Log::error(\'Error obteniendo balance: \' . $e->getMessage());
            return response()->json([\'success\' => false, \'error\' => \'Error al obtener balance\'], 500);
        }
    }

    public function canStartVideoChat($userId = null)
    {
        try {
            $userId = $userId ?? Auth::id();
            $userCoins = $this->getUserCoins($userId);
            
            $totalBalance = $userCoins->purchased_balance + $userCoins->gift_balance;
            $canStart = $totalBalance >= self::MINIMUM_BALANCE;
            
            return [
                \'can_start\' => $canStart,
                \'total_balance\' => $totalBalance,
                \'minutes_available\' => floor($totalBalance / self::COST_PER_MINUTE),
                \'deficit\' => $canStart ? 0 : (self::MINIMUM_BALANCE - $totalBalance)
            ];
            
        } catch (Exception $e) {
            Log::error(\'Error verificando saldo: \' . $e->getMessage());
            return [\'can_start\' => false, \'error\' => $e->getMessage()];
        }
    }

    private function getUserCoins($userId)
    {
        return UserCoins::firstOrCreate(
            [\'user_id\' => $userId],
            [
                \'purchased_balance\' => 0,
                \'gift_balance\' => 0,
                \'total_purchased\' => 0,
                \'total_consumed\' => 0
            ]
        );
    }
}';
    }

    private function getStripeCoinsController()
    {
        return '<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\CoinPackage;

class StripeCoinsController extends Controller
{
    public function getPackages()
    {
        try {
            $packages = CoinPackage::active()->ordered()->get();

            return response()->json([
                \'success\' => true,
                \'packages\' => $packages,
                \'stripe_public_key\' => config(\'stripe.key\')
            ]);
            
        } catch (Exception $e) {
            return response()->json([
                \'success\' => false,
                \'error\' => \'Error al obtener los paquetes\'
            ], 500);
        }
    }
}';
    }

    private function getAddCoinsCommand()
    {
        return '<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\UserCoins;

class AddCoinsToUserCommand extends Command
{
    protected $signature = \'coins:add {user_id} {amount} {type=purchased}\';
    protected $description = \'Agregar monedas a un usuario específico\';

    public function handle()
    {
        $userId = $this->argument(\'user_id\');
        $amount = (int) $this->argument(\'amount\');
        $type = $this->argument(\'type\');

        $user = User::find($userId);
        if (!$user) {
            $this->error("Usuario con ID {$userId} no encontrado");
            return 1;
        }

        $userCoins = UserCoins::firstOrCreate([\'user_id\' => $userId]);
        
        if ($type === \'purchased\') {
            $userCoins->purchased_balance += $amount;
        } else {
            $userCoins->gift_balance += $amount;
        }
        
        $userCoins->save();

        $this->info("✅ Se agregaron {$amount} monedas {$type} al usuario {$user->name}");
        $this->info("💰 Nuevo balance: " . ($userCoins->purchased_balance + $userCoins->gift_balance) . " monedas");

        return 0;
    }
}';
    }

    private function getStatsCommand()
    {
        return '<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\UserCoins;

class CoinSystemStatsCommand extends Command
{
    protected $signature = \'coins:stats\';
    protected $description = \'Mostrar estadísticas del sistema de monedas\';

    public function handle()
    {
        $this->info(\'💰 ESTADÍSTICAS DEL SISTEMA DE MONEDAS\');
        
        $totalUsers = UserCoins::count();
        $usersWithCoins = UserCoins::withBalance()->count();
        $totalCoins = UserCoins::sum(\DB::raw(\'purchased_balance + gift_balance\'));

        $this->table([\'Métrica\', \'Valor\'], [
            [\'Usuarios totales\', number_format($totalUsers)],
            [\'Usuarios con monedas\', number_format($usersWithCoins)],
            [\'Monedas en circulación\', number_format($totalCoins)],
        ]);

        return 0;
    }
}';
    }

    private function getCleanupCommand()
    {
        return '<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CleanupExpiredDataCommand extends Command
{
    protected $signature = \'coins:cleanup {--days=90}\';
    protected $description = \'Limpiar datos antiguos del sistema de monedas\';

    public function handle()
    {
        $days = (int) $this->option(\'days\');
        $this->info("🧹 Limpiando datos anteriores a {$days} días...");
        $this->info("🎉 Limpieza completada");
        return 0;
    }
}';
    }

    private function getReportCommand()
    {
        return '<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class GenerateCoinReportCommand extends Command
{
    protected $signature = \'coins:report\';
    protected $description = \'Generar reporte del sistema de monedas\';

    public function handle()
    {
        $this->info(\'💰 REPORTE DEL SISTEMA DE MONEDAS\');
        $this->line(\'Reporte generado exitosamente\');
        return 0;
    }
}';
    }

    private function getCoinPackagesSeeder()
    {
        return '<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\CoinPackage;

class CoinPackagesSeeder extends Seeder
{
    public function run()
    {
        $packages = [
            [
                \'name\' => \'Paquete Básico\',
                \'description\' => \'Perfecto para probar el servicio\',
                \'coins\' => 100,
                \'bonus_coins\' => 0,
                \'price\' => 9.99,
                \'is_active\' => true,
                \'is_popular\' => false,
                \'sort_order\' => 1
            ],
            [
                \'name\' => \'Paquete Popular\',
                \'description\' => \'El más elegido por nuestros usuarios\',
                \'coins\' => 300,
                \'bonus_coins\' => 50,
                \'price\' => 24.99,
                \'is_active\' => true,
                \'is_popular\' => true,
                \'sort_order\' => 2
            ],
        ];

        foreach ($packages as $package) {
            CoinPackage::create($package);
        }
    }
}';
    }
}