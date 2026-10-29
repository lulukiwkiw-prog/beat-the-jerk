import { useId, useRef, useState, type ChangeEvent } from 'react';
import { applyLimit, charCount } from '../state/text';

interface Props {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  ariaLabel?: string;
  className?: string;
  testId?: string;
}

/**
 * 有字數上限的輸入框：顯示「目前字數／上限」；達上限後無法再輸入，
 * 貼上超出時只放入能放的部分並提示，不默默截斷已輸入的內容。
 */
export function CharField({ label, value, onChange, max, placeholder, multiline, rows = 3, ariaLabel, className, testId }: Props) {
  const id = useId();
  const [notice, setNotice] = useState('');
  const composing = useRef(false);
  const beforeCompose = useRef(value);
  const count = charCount(value);

  const commit = (prev: string, next: string) => {
    const r = applyLimit(prev, next, max);
    if (r.dropped > 0) setNotice(`已達 ${max} 字上限，有 ${r.dropped} 字沒有放進去。`);
    else if (charCount(r.value) < max) setNotice('');
    onChange(r.value);
  };

  const handle = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = e.target.value;
    // 注音／拼音組字中先不擋，組字完成再檢查
    if (composing.current) onChange(next);
    else commit(value, next);
  };

  const common = {
    id,
    value,
    placeholder,
    'aria-label': ariaLabel,
    'aria-describedby': `${id}-count`,
    'data-testid': testId,
    onChange: handle,
    onCompositionStart: () => {
      composing.current = true;
      beforeCompose.current = value;
    },
    onCompositionEnd: (e: { currentTarget: { value: string } }) => {
      composing.current = false;
      commit(beforeCompose.current, e.currentTarget.value);
    },
    autoComplete: 'off',
    spellCheck: false,
  };

  return (
    <div className={`field ${className ?? ''}`}>
      {label && <label htmlFor={id} className="field-label">{label}</label>}
      {multiline ? <textarea rows={rows} {...common} /> : <input type="text" {...common} />}
      <div className="field-meta">
        <span className="field-notice" role="status">{notice}</span>
        <span id={`${id}-count`} className={`count ${count >= max ? 'full' : ''}`}>
          {count}／{max}
        </span>
      </div>
    </div>
  );
}
