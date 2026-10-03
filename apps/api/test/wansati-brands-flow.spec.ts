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
  it('welcomes without interpreting the first message and opens the New Enquiry list', () => {
    const welcome = text(initial, 'How long is delivery?');
    expect(welcome.stateAfter.node).toBe('ENTRY');
    expect(welcome.output).toMatchObject({
      type: 'interactive', body: expect.stringContaining('Welcome to Wansati Brands 🛍️'),
      options: [{ id: 'EXISTING', label: 'Existing Matter' }, { id: 'NEW', label: 'New Enquiry' }],
    });
    const main = option(welcome.stateAfter, 'NEW');
    expect(main.stateAfter.node).toBe('MAIN');
    expect(main.output).toMatchObject({
      type: 'interactive', body: 'What can we help you with?', listButtonLabel: 'Choose an enquiry',
      options: [
        { id: 'wansati_enquiry_shop_products', label: 'Shop & Products' },
        { id: 'wansati_enquiry_orders_delivery', label: 'Orders & Delivery' },
        { id: 'wansati_enquiry_payments', label: 'Payments' },
        { id: 'wansati_enquiry_returns_exchanges', label: 'Returns & Exchanges' },
        { id: 'wansati_enquiry_custom_designs', label: 'Custom Designs' },
        { id: 'wansati_enquiry_speak_sales', label: 'Speak to Sales' },
        { id: 'wansati_enquiry_back', label: 'Back' },
      ],
    });
    expect(main.output?.type === 'interactive' ? main.output.body : '').not.toMatch(/(?:^|\n)\d+\.\s/);
    expect(option(main.stateAfter, 'wansati_enquiry_orders_delivery').stateAfter.node).toBe('ORDERS');
    const recovery = text(main.stateAfter, '1');
    expect(recovery.stateAfter.node).toBe('MAIN');
    expect(recovery.output).toMatchObject({
      type: 'interactive', body: expect.stringContaining('Please choose one of the available options'), listButtonLabel: 'Choose an enquiry',
    });
  });

  it('collects the exact existing-matter explanation and requests handover', () => {
    const collecting = option({ node: 'ENTRY', answers: {} }, 'EXISTING');
    expect(collecting.stateAfter.node).toBe('COLLECT:existing_matter:0');
    const completed = text(collecting.stateAfter, '  Please call me about my order.  ');
    expect(completed.requestType).toBe('existing_matter');
    expect(completed.stateAfter.answers.explanation).toBe('  Please call me about my order.  ');
    expect(completed.handoverRequested).toBe(true);
  });

  it('navigates Back and Main Menu through stable interactive IDs', () => {
    const shop = option({ node: 'MAIN', answers: {} }, 'wansati_enquiry_shop_products');
    expect(shop.stateAfter.node).toBe('SHOP');
    expect(option(shop.stateAfter, 'BACK').stateAfter.node).toBe('MAIN');
    expect(option(shop.stateAfter, 'MAIN_MENU').stateAfter.node).toBe('MAIN');
    const payments = option({ node: 'MAIN', answers: {} }, 'wansati_enquiry_payments');
    expect(payments.stateAfter.node).toBe('PAYMENTS');
    expect(option(payments.stateAfter, 'BACK').stateAfter.node).toBe('MAIN');
  });

  it('returns approved delivery and Payflex text', () => {
    const delivery = option({ node: 'DELIVERY', answers: {} }, 'DURATION');
    expect(delivery.output).toMatchObject({ body: expect.stringContaining('3–4 days') });
    expect(delivery.output).toMatchObject({ type: 'interactive', options: expect.any(Array) });
    expect(delivery.output?.type === 'interactive' ? delivery.output.listButtonLabel : undefined).toBeUndefined();
    const payflex = option({ node: 'PAYFLEX', answers: {} }, 'PAYFLEX_HOW');
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
    const size = option({ node: 'SIZE', answers: {} }, 'SIZE_GUIDE');
    expect(size.output).toMatchObject({ body: expect.stringContaining('not configured') });
    const payment = option({ node: 'PAYMENTS', answers: {} }, 'PAYMENT_INFO');
    expect(payment.output).toMatchObject({ body: expect.stringContaining('For other payment information') });
    const refund = option({ node: 'RETURNS', answers: {} }, 'REFUND');
    expect(refund.output).toMatchObject({ body: expect.stringContaining('not a return-request window') });
  });

  it('uses the configured website and routes order-specific FAQs to a person', () => {
    const website = option({ node: 'PLACE', answers: {} }, 'WEBSITE');
    expect(website.output).toMatchObject({ body: expect.stringContaining('https://www.wansatibrands.co.za/') });
    const dispatch = option({ node: 'DELIVERY', answers: {} }, 'DISPATCH');
    expect(dispatch.output).toMatchObject({ body: expect.stringContaining('For your specific order') });
    expect(option(dispatch.stateAfter, 'TRACK').stateAfter.node).toBe('COLLECT:order_tracking:0');
  });
});
