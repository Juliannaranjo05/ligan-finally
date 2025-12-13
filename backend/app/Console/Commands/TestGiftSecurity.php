<?php
namespace App\Console\Commands;
use Illuminate\Console\Command;

class TestGiftSecurity extends Command
{
    protected $signature = 'test:gift-security';
    protected $description = 'Probar validaciones de seguridad del middleware';

    public function handle()
    {
        $tester = new \Tests\Feature\GiftSecurityMiddlewareTest();
        $tester->setUp();
        $tester->runAllSecurityTests();
    }
}