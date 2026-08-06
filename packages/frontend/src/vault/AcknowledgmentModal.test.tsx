// @vitest-environment jsdom
/**
 * The vault acknowledgment stage is only reachable after a successful upload
 * round-trip (which needs the backend), so it is easy to leave untested. It
 * owns one of the config export entry points, so pin it directly.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import AcknowledgmentModal from './AcknowledgmentModal';
import { DEFAULT_CONFIG } from '../generation-config';

const cfg = { ...DEFAULT_CONFIG, seedPhrase: 'vault seed', includeSalt: true, salt: 'vsalt' };

afterEach(cleanup);

function mount() {
  return render(
    <AcknowledgmentModal
      isOpen
      onConfirm={() => {}}
      onClose={() => {}}
      includeSalt
      fullConfig={cfg}
    />
  );
}

describe('vault AcknowledgmentModal config export', () => {
  it('mounts and no longer shows the legacy download label', () => {
    mount();
    expect(screen.queryByText(/Download Configuration \(JSON\)/i)).toBeNull();
  });

  it('reaches a "Save Config" button that opens the v2 string modal', async () => {
    mount();

    // Walk forward through the stages until the config stage appears.
    for (let i = 0; i < 4; i++) {
      const save = screen.queryByRole('button', { name: /^Save Config$/i });
      if (save) {
        fireEvent.click(save);
        await waitFor(() => {
          const ta = document.querySelector('#config-io-save-text') as HTMLTextAreaElement | null;
          expect(ta).not.toBeNull();
          expect(ta!.value.startsWith('v2:')).toBe(true);
          expect(ta!.value).toContain('vault seed');
          expect(ta!.value).toContain('vsalt');
        });
        return;
      }
      // Tick any checkbox on this stage, then advance.
      screen.queryAllByRole('checkbox').forEach((cb) => {
        if (!(cb as HTMLInputElement).checked) fireEvent.click(cb);
      });
      const next = screen
        .queryAllByRole('button')
        .find((b) => /continue|next|confirm|i understand/i.test(b.textContent || ''));
      if (!next || (next as HTMLButtonElement).disabled) break;
      fireEvent.click(next);
    }

    throw new Error('never reached a "Save Config" button in the vault acknowledgment flow');
  });
});
