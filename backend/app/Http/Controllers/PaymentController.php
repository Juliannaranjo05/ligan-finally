<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\User;
use App\Models\UserPaymentMethod;
use App\Models\CoinPurchase;
use App\Notifications\PaymentMethodChanged;
use App\Mail\VerificationCodeMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Services\PlatformSettingsService;

class PaymentController extends Controller
{
    public function updatePaymentMethod(Request $request)
    {
        // Verificar autenticación PRIMERO
        if (!auth('sanctum')->check()) {
            return response()->json(['error' => 'No autenticado'], 401);
        }
        
        $user = auth('sanctum')->user();
        
        Log::info('🔍 DEBUG: updatePaymentMethod called', [
            'user_id' => $user->id,
            'user_email' => $user->email,
            'request_data' => $request->all()
        ]);

        $validator = Validator::make($request->all(), [
            'country_code' => 'required|string|max:10',
            'country_name' => 'required|string|max:100',
            'payment_method' => 'required|in:bancolombia,nequi,payoneer,trc20',
            'account_details' => 'required|string|max:255',
            'account_holder_name' => 'required|string|max:255',
        ]);

        if ($validator->fails()) {
            Log::error('❌ Validation failed', ['errors' => $validator->errors()]);
            return response()->json(['error' => $validator->errors()->first()], 400);
        }

        // 🔥 GUARDAR TEMPORALMENTE LOS DATOS SIN APLICAR CAMBIOS AÚN
        $pendingPaymentData = [
            'country_code' => $request->input('country_code'),
            'country_name' => $request->input('country_name'),
            'payment_method' => $request->input('payment_method'),
            'account_details' => $request->input('account_details'),
            'account_holder_name' => $request->input('account_holder_name'),
        ];

        // Guardar datos pendientes (puedes usar cache, sesión o campo en BD)
        cache()->put("pending_payment_data_{$user->id}", $pendingPaymentData, now()->addMinutes(20));

        Log::info('✅ Payment data stored temporarily for verification', [
            'user_id' => $user->id,
            'payment_method' => $pendingPaymentData['payment_method']
        ]);

        // 📧 ENVIAR CÓDIGO DE VERIFICACIÓN INMEDIATAMENTE
        try {
            $this->sendVerificationCodeInternal($user);
            
            return response()->json([
                'message' => 'Código de verificación enviado. Confirma tu código para completar el cambio.',
                'data' => [
                    'verification_required' => true,
                    'pending_method' => $pendingPaymentData['payment_method']
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('❌ Error sending verification code: ' . $e->getMessage());
            return response()->json(['error' => 'Error al enviar el código de verificación.'], 500);
        }
    }

    // 📧 MÉTODO INTERNO PARA ENVIAR CÓDIGO
    private function sendVerificationCodeInternal($user)
    {
        // Generar código de 6 dígitos
        $verificationCode = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
        
        // Guardar código temporalmente (no en BD hasta verificar)
        cache()->put("verification_code_{$user->id}", $verificationCode, now()->addMinutes(15));
        cache()->put("verification_expires_{$user->id}", now()->addMinutes(15), now()->addMinutes(15));

        Log::info('✅ Verification code generated', [
            'user_id' => $user->id,
            'code' => $verificationCode,
            'expires_at' => now()->addMinutes(15)
        ]);

        // Enviar código al correo
        Mail::to($user->email)->send(new VerificationCodeMail($verificationCode, $user->name));
        
        Log::info('✅ Verification email sent successfully');
    }

    public function sendVerificationCode()
    {
        if (!auth('sanctum')->check()) {
            return response()->json(['error' => 'No autenticado'], 401);
        }
        
        $user = auth('sanctum')->user();
        
        Log::info('🔍 DEBUG: sendVerificationCode called', [
            'user_id' => $user->id,
            'user_email' => $user->email
        ]);

        try {
            $this->sendVerificationCodeInternal($user);
            
            return response()->json([
                'message' => 'Código de verificación reenviado.',
                'expires_at' => now()->addMinutes(15)->toISOString()
            ]);
        } catch (\Exception $e) {
            Log::error('❌ Error sending verification email: ' . $e->getMessage());
            return response()->json(['error' => 'Error al enviar el correo de verificación.'], 500);
        }
    }

    public function verifyCode(Request $request)
    {
        if (!auth('sanctum')->check()) {
            return response()->json(['error' => 'No autenticado'], 401);
        }
        
        $user = auth('sanctum')->user();
        
        Log::info('🔍 DEBUG: verifyCode called', [
            'user_id' => $user->id,
            'submitted_code' => $request->input('verification_code')
        ]);

        $validator = Validator::make($request->all(), [
            'verification_code' => 'required|string|size:6',
        ]);

        if ($validator->fails()) {
            Log::error('❌ Validation failed in verifyCode', ['errors' => $validator->errors()]);
            return response()->json(['error' => $validator->errors()->first()], 400);
        }

        // 🔍 OBTENER CÓDIGO Y EXPIRACIÓN DEL CACHE
        $storedCode = cache()->get("verification_code_{$user->id}");
        $expiresAt = cache()->get("verification_expires_{$user->id}");

        // Verificar si el código existe
        if (!$storedCode) {
            Log::error('❌ No verification code found');
            return response()->json(['error' => 'No se encontró código de verificación. Solicita uno nuevo.'], 400);
        }

        // Verificar si el código ha expirado
        if (!$expiresAt || now()->isAfter($expiresAt)) {
            Log::error('❌ Verification code expired', [
                'expires_at' => $expiresAt,
                'current_time' => now()
            ]);
            // Limpiar cache expirado
            cache()->forget("verification_code_{$user->id}");
            cache()->forget("verification_expires_{$user->id}");
            cache()->forget("pending_payment_data_{$user->id}");
            
            return response()->json(['error' => 'El código de verificación ha expirado.'], 400);
        }

        // Verificar el código
        if ($storedCode !== $request->input('verification_code')) {
            Log::error('❌ Invalid verification code', [
                'expected' => $storedCode,
                'received' => $request->input('verification_code')
            ]);
            return response()->json(['error' => 'Código de verificación incorrecto.'], 400);
        }

        // 🎉 CÓDIGO CORRECTO - AHORA SÍ APLICAR LOS CAMBIOS
        $pendingData = cache()->get("pending_payment_data_{$user->id}");
        
        if (!$pendingData) {
            Log::error('❌ No pending payment data found');
            return response()->json(['error' => 'No se encontraron datos pendientes. Intenta nuevamente.'], 400);
        }

        // Guardar método anterior para notificación
        $previousMethod = $user->payment_method ?? null;

        try {
            // 💾 APLICAR CAMBIOS A LA BASE DE DATOS
            // Actualizar tabla users
            $user->country = $pendingData['country_code'];
            $user->country_name = $pendingData['country_name'];
            $user->payment_method = $pendingData['payment_method'];
            $user->account_details = $pendingData['account_details'];
            $user->account_holder_name = $pendingData['account_holder_name'];
            $user->payment_method_verified = true;
            $user->save();
            
            Log::info('✅ User table updated with payment method and country');

            // También crear registro en tabla payments si existe
            if (class_exists('App\Models\Payment')) {
                Payment::create([
                    'user_id' => $user->id,
                    'payment_method' => $pendingData['payment_method'],
                    'account_details' => $pendingData['account_details'],
                    'account_holder_name' => $pendingData['account_holder_name'],
                    'status' => 'verified',
                ]);
                Log::info('✅ Payment record created and verified');
            }

            // 📧 ENVIAR NOTIFICACIÓN DE CAMBIO EXITOSO
            try {
                Notification::send($user, new PaymentMethodChanged($pendingData['payment_method'], $previousMethod));
                Log::info('✅ Payment method change notification sent');
            } catch (\Exception $e) {
                Log::error('❌ Error sending notification: ' . $e->getMessage());
            }

            // 🧹 LIMPIAR CACHE
            cache()->forget("verification_code_{$user->id}");
            cache()->forget("verification_expires_{$user->id}");
            cache()->forget("pending_payment_data_{$user->id}");

            Log::info('✅ Payment method verified and applied successfully', ['user_id' => $user->id]);

            return response()->json([
                'message' => 'Método de pago verificado y actualizado con éxito.',
                'verified' => true,
                'data' => [
                    'payment_method' => $pendingData['payment_method'],
                    'account_holder_name' => $pendingData['account_holder_name'],
                    'is_verified' => true
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error applying payment method changes: ' . $e->getMessage());
            return response()->json(['error' => 'Error al aplicar los cambios. Intenta nuevamente.'], 500);
        }
    }

    public function getPaymentMethods()
    {
        if (!auth('sanctum')->check()) {
            return response()->json(['error' => 'No autenticado'], 401);
        }
        
        $user = auth('sanctum')->user();
        
        Log::info('🔍 DEBUG: getPaymentMethods called', [
            'user_id' => $user->id,
            'country_code' => $user->country,
            'country_name' => $user->country_name,
            'payment_method' => $user->payment_method,
            'account_details' => $user->account_details,
            'account_holder_name' => $user->account_holder_name,
            'is_verified' => $user->payment_method_verified
        ]);
        
        return response()->json([
            'country_code' => $user->country,
            'country_name' => $user->country_name,
            'current_method' => $user->payment_method,
            'account_details' => $user->account_details,
            'account_holder_name' => $user->account_holder_name,
            'is_verified' => $user->payment_method_verified ?? false,
            'minimum_payout' => $user->minimum_payout ?? PlatformSettingsService::getDecimal('default_minimum_payout', 40.00),
            'available_methods' => [
                'bancolombia' => 'Bancolombia',
                'nequi' => 'Nequi',
                'payoneer' => 'Payoneer',
                'trc20' => 'TRC-20 (USDT)'
            ]
        ]);
    }

    public function updateMinimumPayout(Request $request)
    {
        if (!auth('sanctum')->check()) {
            return response()->json(['error' => 'No autenticado'], 401);
        }
        
        $user = auth('sanctum')->user();
        
        Log::info('🔍 DEBUG: updateMinimumPayout called', [
            'user_id' => $user->id,
            'current_minimum' => $user->minimum_payout,
            'requested_minimum' => $request->input('minimum_payout')
        ]);

        $validator = Validator::make($request->all(), [
            'minimum_payout' => 'required|numeric|in:40,80,120,180,240',
        ]);

        if ($validator->fails()) {
            Log::error('❌ Validation failed for minimum payout', ['errors' => $validator->errors()]);
            return response()->json(['error' => $validator->errors()->first()], 400);
        }

        try {
            $newMinimum = $request->input('minimum_payout');
            $previousMinimum = $user->minimum_payout;
            
            $user->minimum_payout = $newMinimum;
            $user->save();

            Log::info('✅ Minimum payout updated successfully', [
                'user_id' => $user->id,
                'previous_minimum' => $previousMinimum,
                'new_minimum' => $newMinimum
            ]);

            return response()->json([
                'message' => 'Pago mínimo actualizado con éxito',
                'data' => [
                    'previous_minimum' => $previousMinimum,
                    'new_minimum' => $newMinimum,
                    'updated_at' => now()->toISOString()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error updating minimum payout: ' . $e->getMessage());
            return response()->json(['error' => 'Error interno del servidor'], 500);
        }
    }

    public function getMinimumPayout()
    {
        if (!auth('sanctum')->check()) {
            return response()->json(['error' => 'No autenticado'], 401);
        }
        
        $user = auth('sanctum')->user();
        
        Log::info('🔍 DEBUG: getMinimumPayout called', [
            'user_id' => $user->id,
            'current_minimum' => $user->minimum_payout
        ]);
        
        return response()->json([
            'minimum_payout' => $user->minimum_payout ?? PlatformSettingsService::getDecimal('default_minimum_payout', 40.00),
            'available_amounts' => [40, 80, 120, 180, 240],
            'currency' => 'USD'
        ]);
    }

    /**
     * Obtener métodos de pago guardados del usuario
     */
    public function getSavedPaymentMethods()
    {
        if (!auth('sanctum')->check()) {
            return response()->json(['error' => 'No autenticado'], 401);
        }

        $user = auth('sanctum')->user();

        $methods = UserPaymentMethod::where('user_id', $user->id)
            ->active()
            ->orderBy('is_default', 'desc')
            ->orderBy('last_used_at', 'desc')
            ->get()
            ->map(function ($method) {
                return [
                    'id' => $method->id,
                    'payment_type' => $method->payment_type,
                    'display_name' => $method->display_name,
                    'last_four_digits' => $method->last_four_digits,
                    'bank_name' => $method->bank_name,
                    'account_type' => $method->account_type,
                    'is_default' => $method->is_default,
                    'last_used_at' => $method->last_used_at?->toISOString(),
                    'formatted_last_used' => $method->formatted_last_used,
                    'usage_count' => $method->usage_count,
                    'metadata' => $method->metadata
                ];
            });

        return response()->json([
            'success' => true,
            'methods' => $methods
        ]);
    }

    /**
     * Agregar nuevo método de pago
     */
    public function addPaymentMethod(Request $request)
    {
        if (!auth('sanctum')->check()) {
            return response()->json(['error' => 'No autenticado'], 401);
        }

        $user = auth('sanctum')->user();

        $validator = Validator::make($request->all(), [
            'payment_type' => 'required|in:card', // Solo tarjetas permitidas
            'last_four_digits' => 'required|string|size:4|regex:/^[0-9]{4}$/', // Requerido y exactamente 4 dígitos
            'is_default' => 'boolean',
            'metadata' => 'nullable|array'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => $validator->errors()->first()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $isDefault = $request->input('is_default', false);

            // Si se marca como default, desmarcar otros
            if ($isDefault) {
                UserPaymentMethod::where('user_id', $user->id)
                    ->update(['is_default' => false]);
            }

            $method = UserPaymentMethod::create([
                'user_id' => $user->id,
                'payment_type' => 'card', // Solo tarjetas
                'last_four_digits' => $request->input('last_four_digits'),
                'bank_name' => null, // No aplica para tarjetas
                'account_type' => null, // No aplica para tarjetas
                'is_default' => $isDefault,
                'is_active' => true,
                'metadata' => $request->input('metadata')
            ]);

            DB::commit();

            Log::info('✅ Método de pago agregado', [
                'user_id' => $user->id,
                'method_id' => $method->id,
                'payment_type' => $method->payment_type
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Método de pago agregado correctamente',
                'method' => [
                    'id' => $method->id,
                    'payment_type' => $method->payment_type,
                    'display_name' => $method->display_name,
                    'is_default' => $method->is_default
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('❌ Error agregando método de pago: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al agregar el método de pago'
            ], 500);
        }
    }

    /**
     * Actualizar método de pago guardado (principalmente para marcar como default)
     */
    public function updateSavedPaymentMethod(Request $request, $id)
    {
        if (!auth('sanctum')->check()) {
            return response()->json(['error' => 'No autenticado'], 401);
        }

        $user = auth('sanctum')->user();

        $method = UserPaymentMethod::where('user_id', $user->id)
            ->where('id', $id)
            ->first();

        if (!$method) {
            return response()->json([
                'success' => false,
                'error' => 'Método de pago no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'is_default' => 'boolean',
            'metadata' => 'nullable|array'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => $validator->errors()->first()
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Si se marca como default, desmarcar otros
            if ($request->has('is_default') && $request->input('is_default')) {
                UserPaymentMethod::where('user_id', $user->id)
                    ->where('id', '!=', $id)
                    ->update(['is_default' => false]);
            }

            $method->update($request->only([
                'is_default',
                'metadata'
            ]));

            DB::commit();

            Log::info('✅ Método de pago actualizado', [
                'user_id' => $user->id,
                'method_id' => $method->id
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Método de pago actualizado correctamente',
                'method' => [
                    'id' => $method->id,
                    'display_name' => $method->display_name,
                    'is_default' => $method->is_default
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('❌ Error actualizando método de pago: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al actualizar el método de pago'
            ], 500);
        }
    }

    /**
     * Eliminar método de pago (soft delete)
     */
    public function deletePaymentMethod($id)
    {
        if (!auth('sanctum')->check()) {
            return response()->json(['error' => 'No autenticado'], 401);
        }

        $user = auth('sanctum')->user();

        $method = UserPaymentMethod::where('user_id', $user->id)
            ->where('id', $id)
            ->first();

        if (!$method) {
            return response()->json([
                'success' => false,
                'error' => 'Método de pago no encontrado'
            ], 404);
        }

        try {
            $method->deactivate();

            Log::info('✅ Método de pago eliminado', [
                'user_id' => $user->id,
                'method_id' => $method->id
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Método de pago eliminado correctamente'
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error eliminando método de pago: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al eliminar el método de pago'
            ], 500);
        }
    }

    /**
     * Obtener métodos de pago desde historial de compras
     */
    public function getPaymentMethodsFromHistory()
    {
        if (!auth('sanctum')->check()) {
            return response()->json(['error' => 'No autenticado'], 401);
        }

        $user = auth('sanctum')->user();

        try {
            // Obtener compras completadas con Wompi
            $purchases = CoinPurchase::where('user_id', $user->id)
                ->where('payment_method', 'wompi')
                ->where('status', 'completed')
                ->whereNotNull('payment_data')
                ->orderBy('completed_at', 'desc')
                ->limit(50)
                ->get();

            $methodsFromHistory = [];

            foreach ($purchases as $purchase) {
                $paymentData = is_string($purchase->payment_data) 
                    ? json_decode($purchase->payment_data, true) 
                    : $purchase->payment_data;

                if (!$paymentData) continue;

                // Intentar extraer información del método de pago usado
                // Wompi puede incluir esta info en payment_data
                $paymentType = $paymentData['payment_type'] ?? null;
                $lastFour = $paymentData['last_four_digits'] ?? null;
                $bankName = $paymentData['bank_name'] ?? null;

                if ($paymentType) {
                    $key = "{$paymentType}_{$lastFour}_{$bankName}";
                    
                    if (!isset($methodsFromHistory[$key])) {
                        $methodsFromHistory[$key] = [
                            'payment_type' => $paymentType,
                            'last_four_digits' => $lastFour,
                            'bank_name' => $bankName,
                            'last_used_at' => $purchase->completed_at?->toISOString(),
                            'usage_count' => 1
                        ];
                    } else {
                        $methodsFromHistory[$key]['usage_count']++;
                        if ($purchase->completed_at && 
                            (!$methodsFromHistory[$key]['last_used_at'] || 
                             $purchase->completed_at->gt($methodsFromHistory[$key]['last_used_at']))) {
                            $methodsFromHistory[$key]['last_used_at'] = $purchase->completed_at->toISOString();
                        }
                    }
                }
            }

            return response()->json([
                'success' => true,
                'methods' => array_values($methodsFromHistory)
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error obteniendo métodos del historial: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al obtener métodos del historial'
            ], 500);
        }
    }
}