import type { NormalizedBotInput, StructuredBotOutput, WansatiBotState, WansatiTransitionDecision } from './built-in-bot-runtime.types.js';

type Choice = { readonly id: string; readonly label: string; readonly target: string };
type Menu = { readonly heading: string; readonly parent: string | null; readonly choices: readonly Choice[] };
type Collection = { readonly requestType: string; readonly fields: readonly { readonly key: string; readonly prompt: string; readonly optional?: boolean }[] };

const choice = (id: string, label: string, target: string): Choice => ({ id, label, target });
const menus: Readonly<Record<string, Menu>> = {
  ENTRY: { heading: 'Welcome to Wansati Brands 🛍️\n\nHow can we assist you today?', parent: null, choices: [choice('EXISTING', 'Continue an Existing Matter', 'COLLECT:existing_matter:0'), choice('NEW', 'Start a New Enquiry', 'MAIN')] },
  MAIN: { heading: 'Please choose a Wansati Brands enquiry:', parent: 'ENTRY', choices: [choice('SHOP', 'Shop & Products', 'SHOP'), choice('ORDERS', 'Orders & Delivery', 'ORDERS'), choice('PAYMENTS', 'Payments', 'PAYMENTS'), choice('RETURNS', 'Returns & Exchanges', 'RETURNS'), choice('CUSTOM', 'Custom Designs', 'CUSTOM'), choice('SALES', 'Speak to Sales', 'COLLECT:sales_assistance:0')] },
  SHOP: { heading: 'Shop & Products', parent: 'MAIN', choices: [choice('PLACE', 'Place an Order', 'PLACE'), choice('AVAILABILITY', 'Product Availability', 'COLLECT:product_availability:0'), choice('SIZE', 'Size Guide & Fit Assistance', 'SIZE')] },
  PLACE: { heading: 'Place an Order', parent: 'SHOP', choices: [choice('WEBSITE', 'Shop on the Website', 'FAQ:WEBSITE'), choice('WA_ORDER', 'Order Through WhatsApp', 'COLLECT:whatsapp_order:0'), choice('CHOOSE', 'Help Choosing a Product', 'COLLECT:product_selection:0')] },
  SIZE: { heading: 'Size Guide & Fit Assistance', parent: 'SHOP', choices: [choice('SIZE_GUIDE', 'View Size Guide', 'FAQ:SIZE_GUIDE'), choice('MEASUREMENTS', 'What Measurements Do I Need?', 'FAQ:MEASUREMENTS'), choice('BETWEEN', "I'm Between Sizes", 'COLLECT:between_sizes:0'), choice('STRETCH', 'Does This Item Stretch?', 'COLLECT:stretch:0'), choice('FIT_HELP', 'Help With My Measurements', 'COLLECT:fit_help:0'), choice('SIZE_EXCHANGE', 'Exchange for Another Size', 'COLLECT:exchange_item:0')] },
  ORDERS: { heading: 'Orders & Delivery', parent: 'MAIN', choices: [choice('DELIVERY', 'Delivery Information', 'DELIVERY'), choice('URGENT', 'Urgent Order / Delivery', 'COLLECT:urgent_order:0'), choice('TRACK', 'Track My Order', 'COLLECT:order_tracking:0')] },
  DELIVERY: { heading: 'Delivery Information', parent: 'ORDERS', choices: [choice('DURATION', 'How Long Does Delivery Take?', 'FAQ:DURATION'), choice('DISPATCH', 'When Will My Order Be Dispatched?', 'FAQ:DISPATCH'), choice('SPECIFIC_DATE', 'I Need It by a Specific Date', 'COLLECT:urgent_order:0')] },
  PAYMENTS: { heading: 'Payments', parent: 'MAIN', choices: [choice('PAYFLEX', 'Payflex / Instalments', 'PAYFLEX'), choice('PAYMENT_INFO', 'Payment Information', 'FAQ:PAYMENT_INFO')] },
  PAYFLEX: { heading: 'Payflex / Instalments', parent: 'PAYMENTS', choices: [choice('PAYFLEX_CHECKOUT', 'Payflex at Checkout', 'FAQ:PAYFLEX_CHECKOUT'), choice('PAYFLEX_HOW', 'How Does Payflex Work?', 'FAQ:PAYFLEX_HOW')] },
  RETURNS: { heading: 'Returns & Exchanges', parent: 'MAIN', choices: [choice('RETURN', 'Return an Item', 'COLLECT:return_item:0'), choice('EXCHANGE', 'Exchange an Item', 'COLLECT:exchange_item:0'), choice('REFUND', 'Refund Information', 'FAQ:REFUND'), choice('COURIER', 'Return Courier Costs', 'FAQ:COURIER'), choice('DAMAGED', 'Damaged / Incorrect Item', 'COLLECT:damaged_or_incorrect_item:0')] },
  CUSTOM: { heading: 'Custom Designs', parent: 'MAIN', choices: [choice('WEDDING', 'Wedding Dress', 'COLLECT:custom_wedding:0'), choice('MATRIC', 'Matric Dance', 'COLLECT:custom_matric:0'), choice('BRIDESMAIDS', 'Bridesmaids', 'COLLECT:custom_bridesmaids:0'), choice('BIRTHDAY', 'Birthday / Special Event', 'COLLECT:custom_special:0'), choice('OWN_DESIGN', 'I Have My Own Design', 'COLLECT:custom_own:0'), choice('DESIGN_HELP', 'I Need Design Assistance', 'COLLECT:custom_assistance:0')] },
};

const customFields = [
  { key: 'customer_name', prompt: 'What name should our designer use?' },
  { key: 'event_date', prompt: 'What is the event date? We will confirm availability; no date is guaranteed.' },
  { key: 'design_idea', prompt: 'Please describe your design or paste an inspiration link. A picture is not required.' },
  { key: 'preferred_colour', prompt: 'What colour would you prefer?' },
  { key: 'size_or_measurements', prompt: 'What is your size or your measurements in centimetres? Reply Skip if you do not know yet.', optional: true },
  { key: 'outfit_count', prompt: 'How many outfits do you need?' },
] as const;

const collections: Readonly<Record<string, Collection>> = {
  existing_matter: { requestType: 'existing_matter', fields: [{ key: 'explanation', prompt: 'Please briefly tell us what you need assistance with so that our team can continue helping you.' }] },
  sales_assistance: { requestType: 'sales_assistance', fields: [{ key: 'explanation', prompt: 'Please briefly tell us what you need assistance with.' }] },
  whatsapp_order: { requestType: 'whatsapp_order', fields: [{ key: 'product', prompt: 'A Wansati Sales Representative can help you order. Please send the product name or link (photos are not supported here yet).' }, { key: 'size', prompt: 'What is your preferred size?' }, { key: 'quantity', prompt: 'How many do you need?' }] },
  product_selection: { requestType: 'product_selection', fields: [{ key: 'description', prompt: 'Please briefly explain what you are looking for. A Sales Representative can help you choose.' }] },
  product_availability: { requestType: 'product_availability', fields: [{ key: 'product', prompt: 'Please send us the product name or link you would like us to check. Pictures are not supported here yet.' }] },
  between_sizes: { requestType: 'fit_assistance', fields: [{ key: 'product', prompt: 'The best size depends on the design and fit. Please send the product name or link.' }, { key: 'bust_cm', prompt: 'What is your bust measurement in centimetres?' }, { key: 'waist_cm', prompt: 'What is your waist measurement in centimetres?' }, { key: 'hips_cm', prompt: 'What is your hip measurement in centimetres?' }] },
  stretch: { requestType: 'fit_assistance', fields: [{ key: 'product', prompt: 'Stretch depends on the fabric and design. Please send the product name or link so Sales can check.' }] },
  fit_help: { requestType: 'fit_assistance', fields: [{ key: 'measurements_help', prompt: 'A Sales Representative can guide you through taking your bust, waist and hip measurements in centimetres. Please tell us what help you need.' }] },
  urgent_order: { requestType: 'urgent_order', fields: [{ key: 'product', prompt: 'We may be able to assist with an urgent order depending on production and delivery availability. What product do you need?' }, { key: 'size', prompt: 'What size do you need?' }, { key: 'delivery_location', prompt: 'Where should it be delivered?' }, { key: 'required_date', prompt: 'What date do you need it by? A representative must confirm feasibility.' }] },
  order_tracking: { requestType: 'order_tracking', fields: [{ key: 'order_number', prompt: 'Please enter your order number.' }] },
  return_item: { requestType: 'return_item', fields: [{ key: 'order_number', prompt: 'Eligible returns are accepted if the item is undamaged and in acceptable original return condition. Please enter your order number.' }, { key: 'customer_name', prompt: 'What name was the order placed under?' }, { key: 'product', prompt: 'Which product are you returning?' }, { key: 'reason', prompt: 'What is your reason for returning it?' }] },
  exchange_item: { requestType: 'exchange_item', fields: [{ key: 'order_number', prompt: 'Exchanges are subject to availability and the returns policy. Please enter your order number.' }, { key: 'current_product_size', prompt: 'What is the current product and size?' }, { key: 'requested_replacement_size', prompt: 'What replacement product or size would you like?' }] },
  damaged_or_incorrect_item: { requestType: 'damaged_or_incorrect_item', fields: [{ key: 'order_number', prompt: 'We will prioritise this issue. Please enter your order number.' }, { key: 'description', prompt: 'Please describe the damage or incorrect item. Photos are not supported here yet; a representative may request them.' }] },
  custom_wedding: { requestType: 'custom_design', fields: [{ key: 'event_type', prompt: 'Wedding dress enquiry. Please confirm the occasion.' }, ...customFields] },
  custom_matric: { requestType: 'custom_design', fields: [{ key: 'event_type', prompt: 'Matric dance enquiry. Please confirm the occasion.' }, ...customFields] },
  custom_bridesmaids: { requestType: 'custom_design', fields: [{ key: 'event_type', prompt: 'Bridesmaids enquiry. Please confirm the occasion.' }, ...customFields] },
  custom_special: { requestType: 'custom_design', fields: [{ key: 'event_type', prompt: 'What is the birthday or special event?' }, ...customFields] },
  custom_own: { requestType: 'custom_design', fields: [{ key: 'event_type', prompt: 'Your own design enquiry. What is the occasion?' }, ...customFields] },
  custom_assistance: { requestType: 'custom_design', fields: [{ key: 'event_type', prompt: 'What occasion would you like design assistance for?' }, ...customFields] },
};

const faq: Readonly<Record<string, { readonly parent: string; readonly text: string }>> = {
  MEASUREMENTS: { parent: 'SIZE', text: 'For most dresses, please provide your measurements in centimetres for your bust, waist and hips. For certain styles, we may also need your height or preferred dress length.' },
  DURATION: { parent: 'DELIVERY', text: 'Most products are made to order. Orders are normally prepared and dispatched within approximately 3–4 days after the order is placed. Final delivery time depends on destination and courier service. We cannot promise an exact arrival date.' },
  DISPATCH: { parent: 'DELIVERY', text: 'Most Wansati Brands products are made to order. Your order will normally be prepared and dispatched within approximately 3–4 days after your order is placed. For your specific order, choose Track My Order or Speak to Sales.' },
  PAYFLEX_CHECKOUT: { parent: 'PAYFLEX', text: 'Wansati Brands offers Payflex, allowing eligible customers to pay for their purchases in instalments. Select Payflex at checkout when ordering through the website and follow the prompts.' },
  PAYFLEX_HOW: { parent: 'PAYFLEX', text: 'Payflex allows eligible customers to split their purchase into instalments rather than paying the full amount upfront. Available plans, payment dates and approval information are shown by Payflex during checkout.' },
  PAYMENT_INFO: { parent: 'PAYMENTS', text: 'Payflex is available for eligible customers at website checkout. For other payment information, please speak to Sales.' },
  REFUND: { parent: 'RETURNS', text: 'Once the returned item has been received, inspected and confirmed eligible, the product amount is refunded within approximately 7–14 days. This is not a return-request window.' },
  COURIER: { parent: 'RETURNS', text: 'The customer is responsible for the cost of returning the product to Wansati Brands.' },
};

export interface WansatiFlowConfig { readonly website: string | null; readonly sizeGuideUrl: string | null }

export function decideWansatiTransition(state: WansatiBotState, input: NormalizedBotInput, config: WansatiFlowConfig): WansatiTransitionDecision {
  if (state.node === 'INITIAL') return showMenu('ENTRY', {});
  if (state.node.startsWith('HANDOVER:')) return { stateAfter: state, output: null, handoverRequested: true, requestType: state.node.slice('HANDOVER:'.length) };

  if (state.node.startsWith('COLLECT:')) {
    const [, flow, indexText] = state.node.split(':');
    const collection = flow === undefined ? undefined : collections[flow];
    const index = Number(indexText);
    if (collection === undefined || !Number.isInteger(index) || index < 0 || index >= collection.fields.length) throw new Error('Invalid collection state.');
    const field = collection.fields[index];
    if (field === undefined) throw new Error('Invalid collection field.');
    if (input.type !== 'text' || input.text.trim().length === 0) return prompt(state, field.prompt);
    const value = input.text.trim();
    if (value.length > 4_096) return prompt(state, 'Please send a shorter response.');
    const answers = { ...state.answers, ...(field.optional && value.toLowerCase() === 'skip' ? {} : { [field.key]: input.text }) };
    const next = index + 1;
    if (next < collection.fields.length) {
      const nextField = collection.fields[next];
      if (nextField === undefined) throw new Error('Invalid collection field.');
      return prompt({ node: `COLLECT:${flow}:${next}`, answers }, nextField.prompt);
    }
    return { stateAfter: { node: `HANDOVER:${collection.requestType}`, answers }, output: null, handoverRequested: true, requestType: collection.requestType };
  }

  if (state.node.startsWith('FAQ:')) {
    const key = state.node.slice(4);
    const entry = faq[key];
    const parent = entry?.parent ?? (key === 'WEBSITE' ? 'PLACE' : 'SIZE');
    const selection = selectedOption(input, faqChoices(key, parent));
    if (selection !== undefined) return route(selection, config);
    return showFaq(key, config, true);
  }

  const menu = menus[state.node];
  if (menu === undefined) throw new Error('Unknown Wansati state.');
  const selection = selectedOption(input, menuChoices(state.node));
  if (selection === undefined) return showMenu(state.node, state.answers, true);
  return route(selection, config);
}

function selectedOption(input: NormalizedBotInput, choices: readonly Choice[]): Choice | undefined {
  if (input.type === 'interactive_reply') return choices.find((item) => item.id === input.optionId);
  // Numeric replies are explicit menu selections, never natural-language or keyword matching.
  return /^\d{1,2}$/.test(input.text.trim()) ? choices[Number(input.text.trim()) - 1] : undefined;
}

function menuChoices(key: string): readonly Choice[] {
  const menu = menus[key];
  if (menu === undefined) throw new Error('Unknown menu.');
  return [...menu.choices, ...(menu.parent === null ? [] : [choice('BACK', 'Back', menu.parent)]), ...(key === 'MAIN' ? [] : [choice('MAIN_MENU', 'Main Menu', 'MAIN')])];
}

function navigationChoices(parent: string): readonly Choice[] {
  return [choice('BACK', 'Back', parent), choice('MAIN_MENU', 'Main Menu', 'MAIN'), choice('SPEAK_SALES', 'Speak to Sales', 'COLLECT:sales_assistance:0')];
}

function faqChoices(key: string, parent: string): readonly Choice[] {
  if (key === 'DURATION') return [choice('URGENT', 'Urgent Order', 'COLLECT:urgent_order:0'), choice('SPEAK_SALES', 'Speak to Sales', 'COLLECT:sales_assistance:0'), choice('MAIN_MENU', 'Main Menu', 'MAIN')];
  if (key === 'DISPATCH') return [choice('TRACK', 'Track My Order', 'COLLECT:order_tracking:0'), choice('SPEAK_SALES', 'Speak to Sales', 'COLLECT:sales_assistance:0'), choice('MAIN_MENU', 'Main Menu', 'MAIN')];
  if (key === 'PAYMENT_INFO') return [choice('PAYFLEX', 'Payflex Information', 'PAYFLEX'), choice('SPEAK_SALES', 'Speak to Sales', 'COLLECT:sales_assistance:0'), choice('MAIN_MENU', 'Main Menu', 'MAIN')];
  return navigationChoices(parent);
}

function route(selection: Choice, config: WansatiFlowConfig): WansatiTransitionDecision {
  const target = selection.target;
  if (menus[target] !== undefined) return showMenu(target, {});
  if (target.startsWith('COLLECT:')) {
    const flow = target.split(':')[1];
    const first = flow === undefined ? undefined : collections[flow]?.fields[0];
    if (first === undefined) throw new Error('Unknown collection.');
    return prompt({ node: target, answers: {} }, first.prompt);
  }
  if (target.startsWith('FAQ:')) return showFaq(target.slice(4), config);
  throw new Error('Unknown Wansati target.');
}

function showMenu(key: string, answers: Readonly<Record<string, string>>, recovering = false): WansatiTransitionDecision {
  const menu = menus[key];
  if (menu === undefined) throw new Error('Unknown menu.');
  const choices = menuChoices(key);
  const intro = recovering ? 'Please choose one of the available options below so we can assist you.\n\n' : '';
  if (key === 'ENTRY') return {
    stateAfter: { node: key, answers },
    output: { type: 'interactive', body: `${intro}${menu.heading}\n\nContinue an Existing Matter or Start a New Enquiry:`, options: [
      { id: 'EXISTING', label: 'Existing Matter' }, { id: 'NEW', label: 'New Enquiry' },
    ] },
    handoverRequested: false,
  };
  return { stateAfter: { node: key, answers }, output: presentChoices(`${intro}${menu.heading}`, choices), handoverRequested: false };
}

function showFaq(key: string, config: WansatiFlowConfig, recovering = false): WansatiTransitionDecision {
  let text: string;
  if (key === 'WEBSITE') text = config.website === null ? 'Our website link is not configured yet. Please speak to Sales for help ordering.' : `Shop on our website: ${config.website}`;
  else if (key === 'SIZE_GUIDE') text = config.sizeGuideUrl === null ? 'A size-guide link is not configured yet. Sales can help with sizing.' : `View the size guide: ${config.sizeGuideUrl}`;
  else {
    const entry = faq[key];
    if (entry === undefined) throw new Error('Unknown FAQ.');
    text = entry.text;
  }
  const parent = faq[key]?.parent ?? (key === 'WEBSITE' ? 'PLACE' : 'SIZE');
  return { stateAfter: { node: `FAQ:${key}`, answers: {} }, output: presentChoices(`${recovering ? 'Please choose one of the available options below so we can assist you.\n\n' : ''}${text}`, faqChoices(key, parent)), handoverRequested: false };
}

function prompt(state: WansatiBotState, text: string): WansatiTransitionDecision {
  return { stateAfter: state, output: { type: 'text', text }, handoverRequested: false };
}

function presentChoices(body: string, choices: readonly Choice[]): StructuredBotOutput {
  if (choices.length <= 3 && choices.every((item) => item.label.length <= 20)) {
    return { type: 'interactive', body, options: choices.map(({ id, label }) => ({ id, label })) };
  }
  return { type: 'text', text: `${body}\n\n${choices.map((item, index) => `${index + 1}. ${item.label}`).join('\n')}\n\nReply with the number of your choice.` };
}
