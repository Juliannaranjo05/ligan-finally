import React, { useMemo } from 'react';
import { parseCallExtraData, buildCallEventSummary } from '../../utils/callEventUtils';

const toneStyles = {
  success: {
    border: 'border-emerald-500/30',
    background: 'bg-[#0f1a16]',
    icon: 'bg-emerald-500/20 text-emerald-200'
  },
  danger: {
    border: 'border-red-500/40',
    background: 'bg-[#1d1517]',
    icon: 'bg-red-500/20 text-red-200'
  },
  neutral: {
    border: 'border-slate-500/30',
    background: 'bg-[#13141b]',
    icon: 'bg-slate-500/20 text-slate-200'
  }
};

const CallEventBadge = ({
  message,
  currentUserId,
  t,
  formatDuration,
  formatTimestamp
}) => {
  if (!message) {
    return null;
  }

  const extra = useMemo(() => parseCallExtraData(message.extra_data), [message.extra_data]);
  const summary = useMemo(() => buildCallEventSummary({
    eventType: message.type,
    extra,
    currentUserId,
    messageUserId: message.user_id,
    messageUserName: message.user_name,
    t,
    formatDuration
  }), [message.type, extra, currentUserId, message.user_id, message.user_name, t, formatDuration]);

  if (!summary) {
    return null;
  }

  const { tone, Icon, title, descriptionParts } = summary;
  const timestampLabel = typeof formatTimestamp === 'function' && message.created_at
    ? formatTimestamp(message.created_at)
    : null;

  const subtitle = descriptionParts.filter(Boolean).join(' • ');
  const styles = toneStyles[tone] || toneStyles.neutral;

  return (
    <div className="flex justify-center my-3" role="status" aria-live="polite">
      <div className={`flex flex-wrap md:flex-nowrap items-center gap-3 px-4 py-2 rounded-full border ${styles.border} ${styles.background} shadow-lg w-full md:w-auto`}
        style={{ minWidth: '260px' }}>
        <div className={`p-2 rounded-full ${styles.icon}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">{title}</p>
          {subtitle && (
            <p className="text-[11px] text-white/65 leading-tight mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {timestampLabel && (
          <span className="text-[11px] text-white/40 whitespace-nowrap">
            {timestampLabel}
          </span>
        )}
      </div>
    </div>
  );
};

export default CallEventBadge;
