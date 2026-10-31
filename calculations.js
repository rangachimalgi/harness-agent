function add(a, b) {
    return a + b;
}

function subtract(a, b) {
    return a - b;
}

function multiply(a, b) {
    return a * b;
}

function divide(a, b) {
    if (b === 0) {
        throw new Error("Cannot divide by zero");
    }
    return a / b;
}

function percentage(part, total) {
    if (total === 0) {
        throw new Error("Total cannot be zero");
    }
    return (part / total) * 100;
}

const invoice = {
    items: [
        { name: "Design", hours: 12, rate: 1500 },
        { name: "App screens", hours: 20, rate: 1500 },
        { name: "Bug fixes", hours: 4, rate: 1200 },
    ],
    taxRate: 0.18,
};

function lineTotal(item) {
    return multiply(item.hours, item.rate);
}

function invoiceSummary(bill) {
    const subtotal = bill.items.reduce((sum, item) => add(sum, lineTotal(item)), 0);
    const tax = multiply(subtotal, bill.taxRate);
    const total = add(subtotal, tax);
    return { subtotal, tax, total };
}

console.log(invoiceSummary(invoice));
