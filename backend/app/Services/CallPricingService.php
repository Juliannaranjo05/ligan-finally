<?php

namespace App\Services;

use App\Models\CoinPackage;
use Illuminate\Support\Facades\Log;
use App\Services\PlatformSettingsService;

class CallPricingService
{
    public const BASE_COINS_PER_MINUTE = 10;

    public static function getCoinsPerMinute(): int
    {
        return (int) PlatformSettingsService::getInteger('coins_per_minute', self::BASE_COINS_PER_MINUTE);
    }

    public static function getBaseMinuteValueUsd(): float
    {
        $packages = CoinPackage::query()
            ->where('type', 'minutes')
            ->where('is_active', true)
            ->get();

        $totalPrice = 0.0;
        $totalMinutes = 0;
        $coinsPerMinute = self::getCoinsPerMinute();

        foreach ($packages as $package) {
            $minutes = (int) ($package->minutes ?? 0);
            if ($minutes <= 0) {
                $totalCoins = (int) ($package->total_coins ?? $package->coins ?? 0);
                $minutes = $totalCoins > 0 ? (int) floor($totalCoins / $coinsPerMinute) : 0;
            }

            if ($minutes <= 0) {
                continue;
            }

            $price = (float) ($package->price ?? 0);
            if ($price <= 0) {
                continue;
            }

            $totalPrice += $price;
            $totalMinutes += $minutes;
        }

        if ($totalMinutes <= 0) {
            Log::warning('CallPricingService: base minute value fallback applied');
            return 1.00;
        }

        return round($totalPrice / $totalMinutes, 4);
    }

    public static function getCoinsForMinuteIndex(int $minuteIndex, ?float $baseMinuteValueUsd = null, ?int $coinsPerMinute = null): int
    {
        $baseMinuteValueUsd = $baseMinuteValueUsd ?? self::getBaseMinuteValueUsd();
        $coinsPerMinute = $coinsPerMinute ?? self::getCoinsPerMinute();

        if ($baseMinuteValueUsd <= 0) {
            return $coinsPerMinute;
        }

        $userRate = self::getUserRateForMinuteIndex($minuteIndex);
        $minutesEquivalent = $userRate / $baseMinuteValueUsd;
        $coinsFloat = $minutesEquivalent * $coinsPerMinute;

        return (int) ceil($coinsFloat);
    }

    public static function getClientRateForMinuteIndex(int $minuteIndex): float
    {
        return self::getUserRateForMinuteIndex($minuteIndex);
    }

    public static function getUserRateForMinuteIndex(int $minuteIndex): float
    {
        if ($minuteIndex <= 10) {
            return 0.65;
        }

        if ($minuteIndex <= 20) {
            return 0.75;
        }

        if ($minuteIndex <= 40) {
            return 0.90;
        }

        return 1.00;
    }

    public static function getModelRateForMinuteIndex(int $minuteIndex): float
    {
        if ($minuteIndex <= 10) {
            return 0.30;
        }

        if ($minuteIndex <= 20) {
            return 0.36;
        }

        if ($minuteIndex <= 40) {
            return 0.44;
        }

        return 0.48;
    }

    public static function calculateProgressiveEarnings(int $payableMinutes): array
    {
        $modelEarnings = 0.0;
        $platformEarnings = 0.0;
        $clientSpend = 0.0;

        for ($minute = 1; $minute <= $payableMinutes; $minute++) {
            $modelRate = self::getModelRateForMinuteIndex($minute);
            $clientRate = self::getUserRateForMinuteIndex($minute);

            $modelEarnings += $modelRate;
            $clientSpend += $clientRate;
            $platformEarnings += ($clientRate - $modelRate);
        }

        return [
            'model_earnings' => round($modelEarnings, 2),
            'platform_earnings' => round($platformEarnings, 2),
            'client_spend' => round($clientSpend, 2),
        ];
    }

    public static function calculateProgressiveCoins(
        int $startMinuteIndex,
        int $minutesToCharge,
        ?float $baseMinuteValueUsd = null,
        ?int $coinsPerMinute = null
    ): int
    {
        if ($minutesToCharge <= 0) {
            return 0;
        }

        $coins = 0;
        for ($offset = 0; $offset < $minutesToCharge; $offset++) {
            $coins += self::getCoinsForMinuteIndex(
                $startMinuteIndex + $offset,
                $baseMinuteValueUsd,
                $coinsPerMinute
            );
        }

        return $coins;
    }
}
