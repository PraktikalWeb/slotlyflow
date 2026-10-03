import { describe, expect, it } from 'vitest';

import { decideWansatiTransition, type WansatiFlowConfig } from '../src/bots/wansati-brands-flow.js';
import type { WansatiBotState, WansatiTransitionDecision } from '../src/bots/built-in-bot-runtime.types.js';
import { isTrustedBotImplementationKey } from '../src/bots/trusted-bot-implementations.js';

const config: WansatiFlowConfig = { website: 'https://www.wansatibrands.co.za/', sizeGuideUrl: null };
const initial: WansatiBotState = { node: 'INITIAL', answers: {} };

function text(state: WansatiBotState, value: string): WansatiTransitionDecision {
  return decideWansatiTransition(state, { type: 'text', text: value }, config);
}

function option(state: WansatiBotState, optionId: string): WansatiTransitionDecision {
  return decideWansatiTransition(state, { type: 'interactive_reply', optionId }, config);
}

function follow(state: WansatiBotState, ...answers: string[]): WansatiTransitionDecision {
  let result: WansatiTransitionDecision | undefined;
  for (const answer of answers) {
    result = text(state, answer);
    state = result.stateAfter;
  }
  if (result === undefined) throw new Error('No answers supplied');
  return result;
}

describe('WANSATI_BRANDS_V1 deterministic flow', () => {
  it('is in the compiled trusted implementation allow-list', () => {
    expect(isTrustedBotImplementationKey('WANSATI_BRANDS_V1')).toBe(true);
    expect(isTrustedBotImplementationKey('UNREVIEWED_MODULE')).toBe(false);
  });
  it('welcomes without interpreting the first message and opens six categories', () => {
    const welcome = text(initial, 'How long is delivery?');
    expect(welcome.stateAfter.node).toBe('ENTRY');
    expect(welcome.output).toMatchObject({ body: expect.stringContaining('Welcome to Wansati Brands 🛍️') });
    const main = text(welcome.stateAfter, '2');
    expect(main.stateAfter.node).toBe('MAIN');
    expect(main.output).toMatchObject({ type: 'text', text: expect.stringContaining('6. Speak to Sales') });
    const recovery = text(main.stateAfter, 'How long is delivery?');
    expect(recovery.stateAfter.node).toBe('MAIN');
    expect(recovery.output).toMatchObject({ type: 'text', text: expect.stringContaining('Please choose one of the available options') });
  });

  it('collects the exact existing-matter explanation and requests handover', () => {
    const collecting = text({ node: 'ENTRY', answers: {} }, '1');
    expect(collecting.stateAfter.node).toBe('COLLECT:existing_matter:0');
    const completed = text(collecting.stateAfter, '  Please call me about my order.  ');
    expect(completed.requestType).toBe('existing_matter');
    expect(completed.stateAfter.answers.explanation).toBe('  Please call me about my order.  ');
    expect(completed.handoverRequested).toBe(true);
  });

  it('navigates Back and Main Menu without keyword routing', () => {
    const shop = text({ node: 'MAIN', answers: {} }, '1');
    expect(shop.stateAfter.node).toBe('SHOP');
    expect(text(shop.stateAfter, '4').stateAfter.node).toBe('MAIN');
    expect(text(shop.stateAfter, '5').stateAfter.node).toBe('MAIN');
    const payments = text({ node: 'MAIN', answers: {} }, '3');
    expect(payments.stateAfter.node).toBe('PAYMENTS');
    expect(option(payments.stateAfter, 'BACK').stateAfter.node).toBe('MAIN');
  });

  it('returns approved delivery and Payflex text', () => {
    const delivery = text({ node: 'DELIVERY', answers: {} }, '1');
    expect(delivery.output).toMatchObject({ body: expect.stringContaining('3–4 days') });
    const payflex = text({ node: 'PAYFLEX', answers: {} }, '2');
    expect(payflex.output).toMatchObject({ body: expect.stringContaining('Available plans, payment dates and approval') });
  });

  it('collects an urgent order, tracking number, and return/exchange details', () => {
    const urgent = follow({ node: 'COLLECT:urgent_order:0', answers: {} }, 'Red dress', 'M', 'Johannesburg', '2026-12-01');
    expect(urgent.stateAfter.answers).toEqual({ product: 'Red dress', size: 'M', delivery_location: 'Johannesburg', required_date: '2026-12-01' });
    expect(urgent.requestType).toBe('urgent_order');
    const tracking = text({ node: 'COLLECT:order_tracking:0', answers: {} }, 'ORDER-123');
    expect(tracking.stateAfter.answers.order_number).toBe('ORDER-123');
    const returned = follow({ node: 'COLLECT:return_item:0', answers: {} }, 'ORDER-123', 'Nandi', 'Dress', 'Wrong fit');
    expect(returned.requestType).toBe('return_item');
    expect(returned.stateAfter.answers.reason).toBe('Wrong fit');
    const exchanged = follow({ node: 'COLLECT:exchange_item:0', answers: {} }, 'ORDER-123', 'Dress M', 'Dress L');
    expect(exchanged.requestType).toBe('exchange_item');
  });

  it('covers product availability, ordering, size assistance and sales without stock or AI guesses', () => {
    const order = follow({ node: 'COLLECT:whatsapp_order:0', answers: {} }, 'Dress URL', 'L', '2');
    expect(order.requestType).toBe('whatsapp_order');
    expect(order.stateAfter.answers).toEqual({ product: 'Dress URL', size: 'L', quantity: '2' });
    const availability = text({ node: 'COLLECT:product_availability:0', answers: {} }, 'Blue dress');
    expect(availability.requestType).toBe('product_availability');
    const fit = follow({ node: 'COLLECT:between_sizes:0', answers: {} }, 'Dress', '90', '72', '95');
    expect(fit.requestType).toBe('fit_assistance');
    const sales = text({ node: 'COLLECT:sales_assistance:0', answers: {} }, 'Please help me pick a dress');
    expect(sales.requestType).toBe('sales_assistance');
  });

  it('escalates damaged items and collects a custom design without requiring an image', () => {
    const damaged = follow({ node: 'COLLECT:damaged_or_incorrect_item:0', answers: {} }, 'ORDER-42', 'Wrong colour');
    expect(damaged.requestType).toBe('damaged_or_incorrect_item');
    const custom = follow({ node: 'COLLECT:custom_wedding:0', answers: {} }, 'Wedding', 'Nandi', '2027-01-01', 'Blue lace', 'Blue', 'Skip', '1');
    expect(custom.requestType).toBe('custom_design');
    expect(custom.stateAfter.answers.size_or_measurements).toBeUndefined();
    expect(custom.stateAfter.answers.design_idea).toBe('Blue lace');
  });

  it('does not invent stock, payment methods, return windows, or size-guide data', () => {
    const size = text({ node: 'SIZE', answers: {} }, '1');
    expect(size.output).toMatchObject({ body: expect.stringContaining('not configured') });
    const payment = text({ node: 'PAYMENTS', answers: {} }, '2');
    expect(payment.output).toMatchObject({ body: expect.stringContaining('For other payment information') });
    const refund = text({ node: 'RETURNS', answers: {} }, '3');
    expect(refund.output).toMatchObject({ body: expect.stringContaining('not a return-request window') });
  });

  it('uses the configured website and routes order-specific FAQs to a person', () => {
    const website = text({ node: 'PLACE', answers: {} }, '1');
    expect(website.output).toMatchObject({ body: expect.stringContaining('https://www.wansatibrands.co.za/') });
    const dispatch = text({ node: 'DELIVERY', answers: {} }, '2');
    expect(dispatch.output).toMatchObject({ body: expect.stringContaining('For your specific order') });
    expect(option(dispatch.stateAfter, 'TRACK').stateAfter.node).toBe('COLLECT:order_tracking:0');
  });
});
