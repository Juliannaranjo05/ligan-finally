<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\User;
use App\Notifications\PaymentMethodChanged;
use App\Mail\VerificationCodeMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

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
            'minimum_payout' => $user->minimum_payout ?? 40.00,
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
            'minimum_payout' => $user->minimum_payout ?? 40.00,
            'available_amounts' => [40, 80, 120, 180, 240],
            'currency' => 'USD'
        ]);
    }
}