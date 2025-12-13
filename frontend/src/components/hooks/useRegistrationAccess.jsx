// src/hooks/useRegistrationAccess.jsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUser } from '../../utils/auth';

// 🔥 PROTECCIONES GLOBALES CONTRA LOOPS
let GLOBAL_PROCESSING = false;

export function useRegistrationAccess() {
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const hasFetched = useRef(false);
  const componentId = useRef(Math.random().toString(36).substr(2, 9));
  
  // 🎯 DEFINIR PASOS DEL FLUJO DE REGISTRO (SEPARADO POR TIPO DE USUARIO)
  const REGISTRATION_STEPS = {
    // ========== PASO 1: EMAIL NO VERIFICADO ==========
    'email_verification': {
      condition: (user) => !user.email_verified_at,
      allowedPaths: ['/verificaremail'],
      redirectTo: '/verificaremail',
      stepName: 'Verificación de Email'
    },
    
    // ========== PASO 2: EMAIL VERIFICADO PERO SIN ROL ==========
    'role_selection': {
      condition: (user) => {
        const hasEmailVerified = user.email_verified_at;
        const noRole = !user.rol || user.rol === 'user';
        
        return hasEmailVerified && noRole;
      },
      allowedPaths: ['/genero'],
      redirectTo: '/genero',
      stepName: 'Selección de Rol'
    },
    
    // ========== FLUJO MODELO: DOCUMENTOS ENVIADOS - ESPERANDO ==========
    'modelo_waiting_admin': {
      condition: (user) => {
        const hasEmailVerified = user.email_verified_at;
        const isModelo = user.rol === 'modelo';
        const hasMainVerification = user.verificacion_completa; // 🔧 CAMBIADO: Ahora SÍ tiene verificación completa
        
        // 🔧 CORREGIDO: Usar solo verificacion_estado
        const verificacionEstado = user.verificacion_estado;
        const isPending = verificacionEstado === 'pendiente';
        
                
        return hasEmailVerified && isModelo && hasMainVerification && isPending;
      },
      allowedPaths: ['/esperando'],
      redirectTo: '/esperando',
      stepName: 'Modelo - Esperando Aprobación'
    },
    
    // ========== FLUJO MODELO: VERIFICACIÓN RECHAZADA ==========
    'modelo_rejected': {
      condition: (user) => {
        const hasEmailVerified = user.email_verified_at;
        const isModelo = user.rol === 'modelo';
        // Para rechazadas, puede tener o no verificacion_completa
        
        // 🔧 CORREGIDO: Usar solo verificacion_estado
        const verificacionEstado = user.verificacion_estado;
        const isRejected = verificacionEstado === 'rechazada';
        
                
        return hasEmailVerified && isModelo && isRejected;
      },
      allowedPaths: ['/anteveri', '/verificacion'],
      redirectTo: '/anteveri',
      stepName: 'Modelo - Verificación Rechazada'
    },
    
    // ========== FLUJO MODELO: NECESITA VERIFICACIÓN DE DOCUMENTOS ==========
    'modelo_document_submission': {
      condition: (user) => {
        const hasEmailVerified = user.email_verified_at;
        const isModelo = user.rol === 'modelo';
        const noMainVerification = !user.verificacion_completa;
        
        // 🔧 CORREGIDO: Usar solo verificacion_estado
        const verificacionEstado = user.verificacion_estado;
        const notRejected = verificacionEstado !== 'rechazada';
        const notPending = verificacionEstado !== 'pendiente';
        const notApproved = verificacionEstado !== 'aprobada';
        
                
        return hasEmailVerified && isModelo && noMainVerification && notRejected && notPending && notApproved;
      },
      allowedPaths: ['/anteveri', '/verificacion'],
      redirectTo: '/anteveri',
      stepName: 'Modelo - Envío de Documentos'
    },
    
    // ========== FLUJO MODELO: VERIFICACIÓN APROBADA (PRIORIDAD ALTA) ==========
    'modelo_completed': {
      condition: (user) => {
        const hasEmailVerified = user.email_verified_at;
        const isModelo = user.rol === 'modelo';
        
        // 🔧 CORREGIDO: Si el estado es 'aprobada', considerar como completo INDEPENDIENTEMENTE de verificacion_completa
        const verificacionEstado = user.verificacion_estado;
        const isApproved = verificacionEstado === 'aprobada';
        
        // 🎯 LÓGICA: Si está aprobado, está completo (incluso si verificacion_completa es false por inconsistencia de datos)
        const isCompleted = isApproved || (user.verificacion_completa && isApproved);
        
                
        return hasEmailVerified && isModelo && isCompleted;
      },
      allowedPaths: [], // 🚫 BLOQUEAR: No puede acceder a rutas de registro
      redirectTo: '/homellamadas',
      stepName: 'Modelo - Registro Completo'
    },
    
    // ========== FLUJO CLIENTE: COMPLETADO TRAS SELECCIONAR ROL ==========
    'cliente_completed': {
      condition: (user) => {
        const hasEmailVerified = user.email_verified_at;
        const isCliente = user.rol === 'cliente';
        
                
        return hasEmailVerified && isCliente;
      },
      allowedPaths: [], // 🚫 BLOQUEAR: No puede acceder a rutas de registro
      redirectTo: '/homecliente',
      stepName: 'Cliente - Registro Completo'
    },
    
    // ========== FLUJO ADMIN: VERIFICACIÓN APROBADA ==========
    'admin_completed': {
      condition: (user) => {
        const hasEmailVerified = user.email_verified_at;
        const isAdmin = user.rol === 'admin';
        const hasMainVerification = user.verificacion_completa;
        
        // 🔧 CORREGIDO: Usar solo verificacion_estado
        const verificacionEstado = user.verificacion_estado;
        const isApproved = verificacionEstado === 'aprobada';
        
                
        return hasEmailVerified && isAdmin && hasMainVerification && isApproved;
      },
      allowedPaths: [], // 🚫 BLOQUEAR: No puede acceder a rutas de registro
      redirectTo: '/verificacionesadmin',
      stepName: 'Admin - Registro Completo'
    }
  };

  // 🔓 RUTAS PÚBLICAS (no requieren verificación)
  const PUBLIC_ROUTES = [
    '/home',
    '/login', 
    '/logout',
    '/rate-limit-wait'
  ];

  // 🎯 DETERMINAR PASO ACTUAL DEL USUARIO
  const determineCurrentStep = (user) => {
    
    // 🔧 IMPORTANTE: Evaluar en orden específico para modelos
    const stepOrder = [
      'email_verification',           // 1. Sin email verificado
      'role_selection',               // 2. Email verificado pero sin rol
      'modelo_completed',             // 3. Modelo completado (PRIORIDAD - evaluar primero)
      'modelo_waiting_admin',         // 4. Modelo esperando 
      'modelo_rejected',              // 5. Modelo rechazado
      'modelo_document_submission',   // 6. Modelo necesita documentos
      'cliente_completed',            // 7. Cliente completado
      'admin_completed'               // 8. Admin completado
    ];

    for (const stepKey of stepOrder) {
      const stepConfig = REGISTRATION_STEPS[stepKey];
      if (stepConfig.condition(user)) {
                return { key: stepKey, config: stepConfig };
      }
    }

        return null;
  };

  useEffect(() => {
    const checkRegistrationStep = async () => {
      // 🛑 PREVENIR MÚLTIPLES EJECUCIONES
      if (hasFetched.current || GLOBAL_PROCESSING) {
                return;
      }

      const currentPath = location.pathname;

      // 🏃‍♂️ SI ACABA DE VERIFICAR EMAIL, NO INTERCEPTAR
      const justVerified = localStorage.getItem('email_just_verified');
      if (justVerified) {
                localStorage.removeItem('email_just_verified'); // Limpiar bandera
        setLoading(false);
        return;
      }

      // 🔓 Si está en ruta pública, no verificar
      if (PUBLIC_ROUTES.includes(currentPath)) {
                setLoading(false);
        return;
      }

      // Verificar token
      const token = localStorage.getItem('token');
      if (!token) {
                navigate("/home", { replace: true });
        return;
      }

      try {
                
        hasFetched.current = true;
        GLOBAL_PROCESSING = true;

        // Obtener usuario
        const response = await getUser();
        const user = response?.user || response;

        if (!user) {
                    navigate("/home", { replace: true });
          return;
        }

        // 🎯 DETERMINAR PASO ACTUAL
        const userStep = determineCurrentStep(user);
        
        if (!userStep) {
                    navigate("/verificaremail", { replace: true }); // Fallback seguro
          return;
        }

        setCurrentStep(userStep);

        // 🔄 SI EL REGISTRO ESTÁ COMPLETO, BLOQUEAR RUTAS DE REGISTRO
        if (userStep.key.includes('_completed')) {
                    
          // 🚫 BLOQUEAR: Si intenta acceder a cualquier ruta de registro, redirigir a su home
          const allRegistrationPaths = ['/verificaremail', '/genero', '/anteveri', '/verificacion', '/esperando'];
          if (allRegistrationPaths.includes(currentPath)) {
                                    navigate(userStep.config.redirectTo, { replace: true });
            return;
          }
          
          // ✅ Si no está en ruta de registro, delegar a usePageAccess
                    setLoading(false);
          return;
        }

        // 🎯 VERIFICAR SI ESTÁ EN LA RUTA CORRECTA PARA SU PASO
        const isAllowedPath = userStep.config.allowedPaths.includes(currentPath);

        if (!isAllowedPath) {
                    navigate(userStep.config.redirectTo, { replace: true });
          return;
        }

        
      } catch (error) {
                
        // Si hay error de autenticación, redirigir a home
        if (error.response?.status === 401 || error.response?.status === 403) {
          navigate("/home", { replace: true });
        } else {
          // Para otros errores, ir al inicio del flujo
          navigate("/verificaremail", { replace: true });
        }
        
      } finally {
        GLOBAL_PROCESSING = false;
        setLoading(false);
      }
    };

    // 🚀 INICIAR VERIFICACIÓN
    if (!hasFetched.current && !GLOBAL_PROCESSING) {
      checkRegistrationStep();
    }

    // 🧹 CLEANUP
    return () => {
      hasFetched.current = false;
      GLOBAL_PROCESSING = false;
    };

  }, [location.pathname]); // Se ejecuta cuando cambia la ruta

  return { loading, currentStep };
}

// 🛡️ COMPONENTE WRAPPER PARA REGISTRO
export function RegistrationProtectedPage({ children }) {
  const { loading, currentStep } = useRegistrationAccess();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-white/80">Verificando paso de registro...</p>
          {currentStep && (
            <p className="text-pink-400 text-sm mt-2">{currentStep.config?.stepName}</p>
          )}
        </div>
      </div>
    );
  }

  return children;
}