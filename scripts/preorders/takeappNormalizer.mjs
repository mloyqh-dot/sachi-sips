const STAFF_NAME = 'TakeApp Import';
const PREPACKED_CATEGORY = 'Merch';
const WARMABLE_PRODUCTS = new Set([
  'Classic Shio Pan',
  'Scallion Cream Cheese Onion Shio Pan',
  'Spam Musubi',
]);

const PRODUCT_ALIASES = new Map([
  ['Iced Matcha Latte', 'Iced Matcha Latte'],
  ['Iced Strawberry Matcha', 'Iced Strawberry Matcha Latte'],
  ['Iced Strawberry Matcha Latte', 'Iced Strawberry Matcha Latte'],
  ['Iced Lychee Matcha', 'Iced Lychee Matcha Latte'],
  ['Iced Lychee Matcha Latte', 'Iced Lychee Matcha Latte'],
  ['Iced Hojicha Latte', 'Iced Hojicha Latte'],
  ['Iced Banana Hojicha', 'Iced Banana Hojicha Latte'],
  ['Iced Banana Hojicha Latte', 'Iced Banana Hojicha Latte'],
  ['Momotaro (hot)', 'Momotarō - Hot'],
  ['Momotaro (iced)', 'Momotarō - Iced'],
  ['Momotarō (hot)', 'Momotarō - Hot'],
  ['Momotarō (iced)', 'Momotarō - Iced'],
  ['Orthodox (hot)', 'Orthodox - Hot'],
  ['Orthodox (iced)', 'Orthodox - Iced'],
  ['Mocktail Flight', 'Mocktail Flight (Set of 3 mini drinks)'],
  ['Tater Tots', 'Tater Tots'],
  ['Spam Musubi', 'Spam Musubi'],
  ['Classic Shio Pan', 'Classic Shio Pan'],
  ['Scallion Cream Cheese Onion Shio Pan', 'Scallion Cream Cheese Onion Shio Pan'],
  ["Sachi's Postcard", "Sachi's Postcard"],
  ["Sachi's Sticker", "Sachi's Sticker"],
  ["Sachi's Starter Pack", "Sachi's Starter Pack"],
  ["Sachi's Tote", "Sachi's Tote"],
  ['Friends of Sachi Merch Collection', 'Sticker Sheet'],
]);

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes && char === '"' && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === ',') {
      row.push(field);
      field = '';
    } else if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field);
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some(value => value !== '')) rows.push(row);

  const [headers, ...dataRows] = rows;
  if (!headers) return [];

  return dataRows.map(values =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), values[index] ?? '']))
  );
}

export function groupRowsByOrderNumber(rows) {
  const groups = new Map();

  for (const row of rows) {
    const orderNumber = row['Order number']?.trim();
    if (!orderNumber) throw new Error('CSV row is missing Order number');
    const key = buildExternalOrderKey(row);
    if (!groups.has(key)) groups.set(key, { orderNumber, rows: [] });
    groups.get(key).rows.push(row);
  }

  return Array.from(groups.entries()).map(([externalOrderKey, group]) => ({
    externalOrderKey,
    orderNumber: group.orderNumber,
    rows: group.rows,
  }));
}

export function parseOrderType(value) {
  const normalized = value.toLowerCase();
  if (normalized.includes('takeaway')) return 'takeaway';
  if (normalized.includes('dine-in') || normalized.includes('dine in')) return 'dine_in';
  throw new Error(`Unsupported dine-in/takeaway value: ${value}`);
}

export function parseServiceStart({ serviceDate, serviceTime }) {
  const start = serviceTime.split('~')[0]?.trim();
  if (!serviceDate || !start) {
    throw new Error(`Malformed service date/time: ${serviceDate} ${serviceTime}`);
  }

  const date = new Date(`${serviceDate} ${start} GMT+0800`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Unable to parse service date/time: ${serviceDate} ${serviceTime}`);
  }

  return date;
}

export function minutesBefore(date, minutes) {
  return new Date(date.getTime() - minutes * 60 * 1000);
}

export function parseOptions(text = '') {
  const normalized = text.toLowerCase();
  const options = {};

  if (normalized.includes('oat')) options.milk = 'oat';
  if (normalized.includes('dairy')) options.milk = 'dairy';
  if (normalized.includes('less sugar') || normalized.includes('less sweet')) options.sugar = 'less_sweet';
  if (normalized.includes('no sugar')) options.sugar = 'no_sugar';
  if (normalized.includes('normal sugar')) options.sugar = 'normal';
  if (normalized.includes('more sugar')) options.sugar = 'more_sweet';

  return options;
}

function normalizeAscii(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function stripVariantSuffix(name) {
  if (/^Sachi's Postcard\b/i.test(name)) return "Sachi's Postcard";
  if (/^Sachi's Sticker\b/i.test(name)) return "Sachi's Sticker";
  if (/^Sachi's Tote\b/i.test(name)) return "Sachi's Tote";

  return name
    .replace(/\s+-\s+Drink Only\s*$/i, '')
    .replace(/\s+-\s+Make It A Set\s*\([^)]*\)\s*$/i, '')
    .replace(/\s+by\s+thenoobcooks\s*$/i, '')
    .replace(/\s+by\s+ONO\s*$/i, '')
    .replace(/\s+\((?:colour|black\s*&\s*white)\)\s*$/i, '')
    .trim();
}

function buildExternalOrderKey(row) {
  return [
    row['Order number']?.trim(),
    row['Created at']?.trim(),
    row['Customer phone']?.trim(),
    row['Customer name']?.trim(),
  ].filter(Boolean).join('::');
}

function normalizeLineName(name) {
  return stripVariantSuffix(name).replace(/\s+/g, ' ').trim();
}

function createProductMaps(products) {
  const byName = new Map();
  const byAsciiName = new Map();

  for (const product of products) {
    byName.set(product.name, product);
    byAsciiName.set(normalizeAscii(product.name), product);
  }

  return { byName, byAsciiName };
}

export function resolveProduct(productMaps, sourceName) {
  const normalized = normalizeLineName(sourceName);
  const canonical = PRODUCT_ALIASES.get(normalized) ?? normalized;
  const product = productMaps.byName.get(canonical) ?? productMaps.byAsciiName.get(normalizeAscii(canonical));

  if (!product) {
    throw new Error(`No product mapping for "${sourceName}" -> "${canonical}"`);
  }

  return product;
}

function parseNumber(value, label) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return parsed;
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

export function allocateSetPrice(sourceTotal, products) {
  const normalTotal = products.reduce((sum, product) => sum + Number(product.price), 0);
  if (normalTotal <= 0) return products.map((_, index) => index === 0 ? sourceTotal : 0);

  const allocated = products.map(product => roundCurrency(sourceTotal * Number(product.price) / normalTotal));
  const allocatedWithoutLast = allocated.slice(0, -1).reduce((sum, value) => sum + value, 0);
  allocated[allocated.length - 1] = roundCurrency(sourceTotal - allocatedWithoutLast);
  return allocated;
}

function parseMakeItASetName(name) {
  const match = name.match(/^(.*?)\s+-\s+Make It A Set\s*\(([^)]+)\)\s*$/i);
  if (!match) return null;

  return {
    drinkName: match[1].trim(),
    biteName: match[2].trim(),
  };
}

function parseBestieSetOptions(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const drink1 = normalized.match(/Drink\s*#?1\s*:?\s*(.*?)(?=\n\s*Drink\s*#?2|\n\s*Bites?\s*:|$)/i)?.[1]?.trim();
  const drink2 = normalized.match(/Drink\s*#?2\s*:?\s*(.*?)(?=\n\s*Bites?\s*:|$)/i)?.[1]?.trim();
  const bite = normalized.match(/Bites?\s*:?\s*(.*)$/im)?.[1]?.trim();

  if (!drink1 || !drink2 || !bite) {
    throw new Error(`Unable to parse Bestie Set options: ${text}`);
  }

  return { drink1, drink2, bite };
}

function splitInlineMilk(value) {
  const parts = value.split(/\s+-\s+/);
  return {
    name: parts[0].trim(),
    optionText: parts.slice(1).join(' '),
  };
}

function applyDefaultOptions(product, orderType, sourceOptions = {}) {
  const options = { ...sourceOptions };

  if (product.name === 'Iced Banana Hojicha Latte') {
    options.milk = 'oat';
    delete options.sugar;
  }

  if (WARMABLE_PRODUCTS.has(product.name) && !options.warm_up) {
    options.warm_up = orderType === 'dine_in' ? 'warm_up' : 'no_warm_up';
  }

  return Object.keys(options).length > 0 ? options : undefined;
}

function isPrepacked(product) {
  return product.category === PREPACKED_CATEGORY;
}

function buildItem({ product, quantity, unitPrice, options, rawRow, sourceName, sourceOptions, orderType }) {
  const lineTotal = roundCurrency(quantity * unitPrice);

  return {
    product_id: product.id,
    name: product.name,
    quantity,
    unit_price: roundCurrency(unitPrice),
    options: applyDefaultOptions(product, orderType, options),
    line_total: lineTotal,
    prep_required: !isPrepacked(product),
    external_lineitem_name: sourceName,
    external_lineitem_options: sourceOptions,
    external_lineitem_raw: rawRow,
  };
}

function normalizeSingleRow(row, productMaps, orderType) {
  const sourceName = row['Lineitem name']?.trim();
  const sourceOptions = row['Lineitem option'] ?? '';
  const quantity = parseNumber(row['Lineitem quantity'], 'Lineitem quantity');
  const sourceUnitPrice = parseNumber(row['Lineitem price'], 'Lineitem price');
  const makeItASet = parseMakeItASetName(sourceName);

  if (/^Bestie Set\s*$/i.test(sourceName)) {
    const bestie = parseBestieSetOptions(sourceOptions);
    const drink1 = splitInlineMilk(bestie.drink1);
    const drink2 = splitInlineMilk(bestie.drink2);
    const products = [
      resolveProduct(productMaps, drink1.name),
      resolveProduct(productMaps, drink2.name),
      resolveProduct(productMaps, bestie.bite),
    ];
    const allocated = allocateSetPrice(sourceUnitPrice, products);

    return products.map((product, index) => {
      const optionText = index === 0 ? drink1.optionText : index === 1 ? drink2.optionText : '';
      return buildItem({
        product,
        quantity,
        unitPrice: allocated[index],
        options: parseOptions(optionText),
        rawRow: row,
        sourceName,
        sourceOptions,
        orderType,
      });
    });
  }

  if (makeItASet) {
    const products = [
      resolveProduct(productMaps, makeItASet.drinkName),
      resolveProduct(productMaps, makeItASet.biteName),
    ];
    const allocated = allocateSetPrice(sourceUnitPrice, products);
    const drinkOptions = parseOptions(sourceOptions);

    return products.map((product, index) => buildItem({
      product,
      quantity,
      unitPrice: allocated[index],
      options: index === 0 ? drinkOptions : {},
      rawRow: row,
      sourceName,
      sourceOptions,
      orderType,
    }));
  }

  const product = resolveProduct(productMaps, sourceName);

  return [buildItem({
    product,
    quantity,
    unitPrice: sourceUnitPrice,
    options: parseOptions(sourceOptions),
    rawRow: row,
    sourceName,
    sourceOptions,
    orderType,
  })];
}

function buildOrderRaw(firstRow) {
  return {
    date: firstRow.Date,
    order_number: firstRow['Order number'],
    order_name: firstRow['Order name'],
    status: firstRow.Status,
    payment_status: firstRow['Payment Status'],
    fulfillment_status: firstRow['Fulfillment Status'],
    service_date: firstRow['Service date'],
    service_time: firstRow['Service time'],
    customer_phone: firstRow['Customer phone'],
    latest_payment_method: firstRow['Latest payment method'],
    dine_in_takeaway: firstRow['Question 1'],
    created_at: firstRow['Created at'],
  };
}

export function normalizeTakeappRows(rows, products) {
  const productMaps = createProductMaps(products);
  const groups = groupRowsByOrderNumber(rows);
  const errors = [];
  const orders = [];

  for (const group of groups) {
    try {
      const firstRow = group.rows[0];
      const customerName = firstRow['Customer name']?.trim();
      if (!customerName) throw new Error(`Order ${group.orderNumber} is missing customer name`);

      const orderType = parseOrderType(firstRow['Question 1'] ?? '');
      const scheduledFor = parseServiceStart({
        serviceDate: firstRow['Service date'],
        serviceTime: firstRow['Service time'],
      });
      const items = group.rows.flatMap(row => normalizeSingleRow(row, productMaps, orderType));
      const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.line_total, 0));
      const csvSubtotal = roundCurrency(parseNumber(firstRow.Subtotal, 'Subtotal'));
      const csvTotal = roundCurrency(parseNumber(firstRow.Total, 'Total'));

      if (subtotal !== csvSubtotal || subtotal !== csvTotal) {
        throw new Error(`Order ${group.orderNumber} totals do not reconcile: items ${subtotal}, subtotal ${csvSubtotal}, total ${csvTotal}`);
      }

      orders.push({
        external_order_key: group.externalOrderKey,
        external_order_number: group.orderNumber,
        external_order_name: firstRow['Order name']?.trim() || `#${group.orderNumber}`,
        customer_name: customerName,
        order_type: orderType,
        scheduled_for: scheduledFor.toISOString(),
        release_at: minutesBefore(scheduledFor, 30).toISOString(),
        prep_due_at: minutesBefore(scheduledFor, 15).toISOString(),
        preorder_payment_status: firstRow['Payment Status']?.trim() || null,
        preorder_fulfillment_status: firstRow['Fulfillment Status']?.trim() || null,
        subtotal,
        total: csvTotal,
        payment_method: 'other',
        staff_name: STAFF_NAME,
        notes: `Preorder ${firstRow['Order name'] || `#${group.orderNumber}`} · ${firstRow['Payment Status'] || 'Payment unknown'}`,
        external_raw: buildOrderRaw(firstRow),
        items,
      });
    } catch (error) {
      errors.push({
        orderNumber: group.orderNumber,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    orders,
    summary: {
      rowCount: rows.length,
      orderCount: groups.length,
      normalizedOrderCount: orders.length,
      errorCount: errors.length,
      errors,
    },
  };
}
