// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';

/**
 * Covers the "Add credit with coupon" step. The vault flow that normally reaches
 * this modal requires selecting the correct words in the recovery grid, which a
 * browser test can't drive without reimplementing the game's derivation — so the
 * step is exercised here at the component level instead.
 *
 * vault-api is mocked: request signing is covered by the backend auth tests and
 * the live prod checks, and what matters here is the UI's behaviour around it.
 */

const redeemCoupon = vi.fn();

vi.mock('./vault-api', () => ({
  redeemCoupon: (...args: unknown[]) => redeemCoupon(...args),
}));

const AUTH_KEYS = { address: 'a'.repeat(64), signingSecretKeyHex: 'b'.repeat(128) };

async function openCouponStep() {
  const { default: AddCreditsModal } = await import('./AddCreditsModal');

  render(
    <AddCreditsModal
      isOpen
      onClose={() => {}}
      address={AUTH_KEYS.address}
      authKeys={AUTH_KEYS}
      includeSalt={false}
      skipAcknowledgment
    />
  );

  const button = screen.getByRole('button', { name: 'Add credit with coupon' });
  fireEvent.click(button);
  return screen.getByLabelText('Token') as HTMLInputElement;
}

beforeEach(() => {
  redeemCoupon.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('AddCreditsModal coupon step', () => {
  it('offers a dedicated coupon button alongside the payment methods', async () => {
    const { default: AddCreditsModal } = await import('./AddCreditsModal');
    render(
      <AddCreditsModal
        isOpen onClose={() => {}} address={AUTH_KEYS.address}
        authKeys={AUTH_KEYS} includeSalt={false} skipAcknowledgment
      />
    );

    expect(screen.getByRole('button', { name: 'Pay with Card' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pay with Crypto' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add credit with coupon' })).toBeTruthy();
  });

  it('switches to a token entry step', async () => {
    const input = await openCouponStep();
    expect(input).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Add credit with coupon' })).toBeTruthy();
    // Payment buttons are gone — this is a distinct step, not an addition.
    expect(screen.queryByRole('button', { name: 'Pay with Card' })).toBeNull();
  });

  it('keeps Redeem disabled until a token is entered', async () => {
    const input = await openCouponStep();
    const redeem = () => screen.getByRole('button', { name: 'Redeem' }) as HTMLButtonElement;

    expect(redeem().disabled).toBe(true);
    fireEvent.change(input, { target: { value: '   ' } });
    expect(redeem().disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'PG-ABCDE' } });
    expect(redeem().disabled).toBe(false);
  });

  it('redeems and shows the credits added and the new balances', async () => {
    redeemCoupon.mockResolvedValue({ credits: 5, gbYearsRemaining: 7.5, egressGbRemaining: 375 });

    const input = await openCouponStep();
    fireEvent.change(input, { target: { value: 'PG-ABCDE-FGHIJ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redeem' }));

    await waitFor(() => expect(screen.getByText('5 credits')).toBeTruthy());
    expect(screen.getByText('7.50 GB-years')).toBeTruthy();
    expect(screen.getByText('375.0 GB')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });

  it('passes the auth keys and a trimmed token to the api', async () => {
    redeemCoupon.mockResolvedValue({ credits: 1, gbYearsRemaining: 1, egressGbRemaining: 50 });

    const input = await openCouponStep();
    fireEvent.change(input, { target: { value: '  PG-ABCDE  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redeem' }));

    await waitFor(() => expect(redeemCoupon).toHaveBeenCalledTimes(1));
    expect(redeemCoupon).toHaveBeenCalledWith(AUTH_KEYS, 'PG-ABCDE');
  });

  it('says "1 credit" rather than "1 credits"', async () => {
    redeemCoupon.mockResolvedValue({ credits: 1, gbYearsRemaining: 1, egressGbRemaining: 50 });

    const input = await openCouponStep();
    fireEvent.change(input, { target: { value: 'PG-ABCDE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redeem' }));

    await waitFor(() => expect(screen.getByText('1 credit')).toBeTruthy());
  });

  it('shows the server error and stays on the step so the token can be corrected', async () => {
    redeemCoupon.mockRejectedValue(new Error('That token has already been used'));

    const input = await openCouponStep();
    fireEvent.change(input, { target: { value: 'PG-USED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redeem' }));

    await waitFor(() => expect(screen.getByText('That token has already been used')).toBeTruthy());
    // Still on the entry step, token preserved.
    expect((screen.getByLabelText('Token') as HTMLInputElement).value).toBe('PG-USED');
    expect(screen.getByRole('button', { name: 'Redeem' })).toBeTruthy();
  });

  it('re-enables Redeem after a failure', async () => {
    redeemCoupon.mockRejectedValue(new Error('nope'));

    const input = await openCouponStep();
    fireEvent.change(input, { target: { value: 'PG-X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redeem' }));

    await waitFor(() => expect(screen.getByText('nope')).toBeTruthy());
    expect((screen.getByRole('button', { name: 'Redeem' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('goes back to the payment methods', async () => {
    await openCouponStep();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('button', { name: 'Pay with Card' })).toBeTruthy();
    expect(screen.queryByLabelText('Token')).toBeNull();
  });

  it('points at /coupons for getting a token', async () => {
    await openCouponStep();
    expect(screen.getByText(/coupons/)).toBeTruthy();
  });
});
