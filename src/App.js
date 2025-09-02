import React, { useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import './App.css';
import signatureImage from './signature.png'; // Make sure this image exists or remove its usage

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

// Helper to format invoice numbers
const formatInvoiceNumber = (num) => String(num).padStart(4, '0');

function App() {
    const invoiceRef = useRef(null);
    const [customerName, setCustomerName] = useState('');
    const [customerMobile, setCustomerMobile] = useState('');
    // Each item now includes its own gstPercentage
    const [items, setItems] = useState([{ name: '', qty: '', rate: '', gstPercentage: 0 }]);
    const [discountPercentage, setDiscountPercentage] = useState(0); // New state for discount
    const [loading, setLoading] = useState(false);
    const [currentInvoiceNumber, setCurrentInvoiceNumber] = useState(1001); // Starting series for THM-1001

    // Generate Invoice number and Date
    const invoiceNumber = `THM-${formatInvoiceNumber(currentInvoiceNumber)}`;
    const date = new Date().toLocaleDateString('en-GB');

    // Fetch the last invoice number from the backend on component mount
    useEffect(() => {
        const fetchLastInvoiceNumber = async () => {
            try {
                const response = await fetch('https://balajimawa.onrender.com/api/bills');
                if (response.ok) {
                    const bills = await response.json();
                    if (bills && bills.length > 0) {
                        // Find the highest number from existing THM-XXXX invoices
                        const highestNum = bills.reduce((max, bill) => {
                            const match = bill.invoiceNumber.match(/^THM-(\d+)$/);
                            if (match) {
                                return Math.max(max, parseInt(match[1], 10));
                            }
                            return max;
                        }, 1000); // Start from 1000 if no THM- series found
                        setCurrentInvoiceNumber(highestNum + 1);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch last invoice number:", error);
                // If fetching fails, we'll just start from 1001
            }
        };
        fetchLastInvoiceNumber();
    }, []);

    const handleItemChange = (index, event) => {
        const { name, value } = event.target;
        const list = [...items];

        if (['qty', 'rate', 'gstPercentage'].includes(name)) {
            list[index][name] = value === "" ? "" : parseFloat(value);
        } else {
            list[index][name] = value;
        }

        setItems(list);
    };


    const handleAddItem = () => setItems([...items, { name: '', qty: '', rate: '', gstPercentage: 0 }]);

    const handleRemoveItem = (index) => {
        const list = [...items];
        list.splice(index, 1);
        setItems(list);
    };

    // Calculate item total *before* its own GST
    const calculateItemSubTotal = (qty, rate) => (parseFloat(qty) * parseFloat(rate)) || 0;

    // Calculate item total *including* its own GST
    const calculateItemTotalWithGST = (qty, rate, gst) => {
        const itemSubTotal = calculateItemSubTotal(qty, rate);
        return itemSubTotal * (1 + (gst / 100));
    };

    // Sum of all item sub-totals (before item-level GST)
    const totalItemsSubTotal = items.reduce((acc, item) => acc + calculateItemSubTotal(item.qty, item.rate), 0);

    // Sum of all item-level GSTs
    const totalItemsGSTAmount = items.reduce((acc, item) => {
        const itemSubTotal = calculateItemSubTotal(item.qty, item.rate);
        return acc + (itemSubTotal * (item.gstPercentage / 100));
    }, 0);

    // Subtotal including all item-level GSTs, before discount
    const subTotalWithAllGST = totalItemsSubTotal + totalItemsGSTAmount;

    // Calculate discount amount
    const discountAmount = subTotalWithAllGST * (discountPercentage / 100);

    // Grand total after discount
    const grandTotalAfterDiscount = subTotalWithAllGST - discountAmount;

    // For backend compatibility: we'll sum all item GSTs and represent it as a single GST percentage and amounts.
    // This is a simplification to fit the existing backend schema.
    // In a real-world scenario, the backend schema should be updated to handle per-item GST.
    const effectiveTotalGSTAmount = totalItemsGSTAmount;
    const effectiveCGST = effectiveTotalGSTAmount / 2;
    const effectiveSGST = effectiveTotalGSTAmount / 2;

    // We need an "overall GST percentage" for the backend, even if it's not truly applied uniformly.
    // If totalItemsSubTotal is 0, effectiveGstPercentage will be 0 to avoid division by zero.
    const effectiveGstPercentageForBackend = totalItemsSubTotal > 0
        ? (effectiveTotalGSTAmount / totalItemsSubTotal) * 100
        : 0;


    const handleSaveAndDownload = async () => {
        if (!customerName || !customerMobile) {
            alert('Please enter Customer Name and Mobile Number.');
            return;
        }
        if (items.some(item => !item.name || !item.qty || !item.rate)) {
            alert('Please fill all item details before saving.');
            return;
        }
        setLoading(true);

        const billData = {
            invoiceNumber,
            date: new Date(),
            customerName,
            customerMobile,
            items: items.map((item, index) => ({
                ...item,
                sno: index + 1,
                // The 'total' field in backend schema likely means subtotal without GST.
                // We'll calculate it this way to fit the existing schema,
                // but in frontend display, we show total with item-level GST.
                total: calculateItemSubTotal(item.qty, item.rate),
            })),
            subTotal: totalItemsSubTotal, // This is the sum of item base totals (before any GST)
            gstPercentage: effectiveGstPercentageForBackend, // Represents the overall effective GST rate
            cgst: effectiveCGST,
            sgst: effectiveSGST,
            grandTotal: grandTotalAfterDiscount,
            // You might want to add discountPercentage to the backend schema if you need to store it
        };

        try {
            const response = await fetch('https://balajimawa.onrender.com/api/bills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(billData),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Failed to save bill.');

            alert(`Bill Saved! Invoice #: ${result.bill.invoiceNumber}. Downloading image...`);
            setCurrentInvoiceNumber(prev => prev + 1); // Increment for the next bill

            if (invoiceRef.current) {
                const dataUrl = await toPng(invoiceRef.current, { pixelRatio: 2.5 });
                const link = document.createElement('a');
                link.download = `Taj-Hotels-Invoice-${invoiceNumber}.png`;
                link.href = dataUrl;
                link.click();
            }
            setCustomerName('');
            setCustomerMobile('');
            setItems([{ name: '', qty: '', rate: '', gstPercentage: 0 }]);
            setDiscountPercentage(0);
        } catch (error) {
            console.error('Error in operation:', error);
            alert(`Operation Failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-container">
            {/* --- THE CONTROL PANEL (All inputs go here) --- */}
            <div className="control-panel">
                <div className="control-panel-section">
                    <h3>Customer Details</h3>
                    <div className="grid-form">
                        <div className="form-group">
                            <label htmlFor="customerName">Name</label>
                            <input id="customerName" type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g., Ankit Sharma" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="customerMobile">Mobile</label>
                            <input id="customerMobile" type="tel" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} placeholder="e.g., 9876543210" />
                        </div>
                    </div>
                </div>

                <div className="control-panel-section">
                    <h3>Items</h3>
                    {items.map((item, index) => (
                        <div key={index} className="item-entry-with-gst"> {/* Changed class name */}
                            <div className="form-group">
                                <label>Item Name</label>
                                <input type="text" name="name" value={item.name} onChange={(e) => handleItemChange(index, e)} placeholder="Mawa, Paneer, etc." />
                            </div>
                            <div className="form-group">
                                <label>Quantity</label>
                                <input type="number" name="qty" value={item.qty} onChange={(e) => handleItemChange(index, e)} placeholder="e.g., 1.5" min="0" onBlur={(e) => {
                                    if (e.target.value === "") {
                                        const list = [...items];
                                        list[index].qty = 0;
                                        setItems(list);
                                    }
                                }} />
                            </div>
                            <div className="form-group">
                                <label>Rate (₹)</label>
                                <input type="number" name="rate" value={item.rate} onChange={(e) => handleItemChange(index, e)} placeholder="e.g., 350" min="0" onBlur={(e) => {
                                    if (e.target.value === "") {
                                        const list = [...items];
                                        list[index].qty = 0;
                                        setItems(list);
                                    }
                                }} />
                            </div>
                            <div className="form-group">
                                <label>GST (%)</label>
                                <input type="number" name="gstPercentage" value={item.gstPercentage} onChange={(e) => handleItemChange(index, e)} placeholder="e.g., 5, 18" min="0" onBlur={(e) => {
                                    if (e.target.value === "") {
                                        const list = [...items];
                                        list[index].qty = 0;
                                        setItems(list);
                                    }
                                }} />
                            </div>
                            <button className="remove-icon-btn" onClick={() => handleRemoveItem(index)} aria-label="Remove Item">
                                <TrashIcon />
                            </button>
                        </div>
                    ))}
                    <div className="item-controls">
                        <button className="add-item-btn" onClick={handleAddItem}>+ Add Item</button>
                    </div>
                </div>

                <div className="control-panel-section">
                    <h3>Discount</h3>
                    <div className="form-group" style={{ maxWidth: '150px' }}>
                        <label htmlFor="discount">Discount Percentage (%)</label>
                        <input id="discount" type="number" value={discountPercentage} onChange={(e) => {
                            const value = e.target.value;
                            setDiscountPercentage(value === "" ? "" : parseFloat(value));
                        }} min="0" />
                    </div>
                </div>
            </div>

            {/* --- THE LIVE BILL PREVIEW (This gets downloaded) --- */}
            <div className="invoice-paper" ref={invoiceRef}>
                <header className="invoice-header">
                    <div className="brand-header">
                        <img
                            src="https://media.licdn.com/dms/image/v2/D4D0BAQHXkXZDaH3LrA/company-logo_200_200/company-logo_200_200/0/1688395472400/taj_hotels_logo?e=2147483647&v=beta&t=VHehTSDfK_VPP3z6Kgd1b3W6uyNVI8NleB0QujVLNTQ"
                            alt="Taj Logo"
                            className="taj-logo"
                            crossOrigin="anonymous"
                        />
                        <h1>Taj Hari Mahal</h1>
                    </div>
                    <p>GSTIN: 08AAACT3957G7Z1</p>
                    <p>Address: 5, Residency Rd, near Badminton court, Surya Colony, Jodhpur, Rajasthan 342011</p>
                </header>

                <section className="details-section">
                    <div>
                        <p><strong>Bill To:</strong> {customerName || '____________________'}</p>
                        <p><strong>Mobile:</strong> {customerMobile || '____________________'}</p>
                    </div>
                    <div>
                        <p><strong>Invoice:</strong> {invoiceNumber}</p>
                        <p><strong>Date:</strong> {date}</p>
                    </div>
                </section>
                <section className="items-section">
                    <table className="items-table">
                        <thead>
                            <tr>
                                <th className="sno">#</th>
                                <th>Item Description</th>
                                <th className="align-right">Qty</th>
                                <th className="align-right">Rate (₹)</th>
                                <th className="align-right">GST (%)</th> {/* New column */}
                                <th className="align-right">Total (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={index}>
                                    <td className="sno">{index + 1}</td>
                                    <td>{item.name || '...'}</td>
                                    <td className="align-right">{item.qty || '...'}</td>
                                    <td className="align-right">{item.rate ? parseFloat(item.rate).toFixed(2) : '...'}</td>
                                    <td className="align-right">{item.gstPercentage ? item.gstPercentage.toFixed(0) : '0'}</td> {/* Display item GST */}
                                    <td className="align-right"><strong>{calculateItemTotalWithGST(item.qty, item.rate, item.gstPercentage).toFixed(2)}</strong></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
                <div className="bill-summary">
                    <div className="invoice-footer">
                        {/* <img src={signatureImage} alt="Signature" className="signature-img" />
                        <p>Authorised Signatory</p> */}
                    </div>
                    <table className="totals-table">
                        <tbody>
                            <tr><td className="label">Items Sub Total:</td><td className="value">₹{totalItemsSubTotal.toFixed(2)}</td></tr>
                            <tr><td className="label">Total GST Amount:</td><td className="value">₹{totalItemsGSTAmount.toFixed(2)}</td></tr>
                            <tr><td className="label">Sub Total (Incl. GST):</td><td className="value">₹{subTotalWithAllGST.toFixed(2)}</td></tr>
                            {discountPercentage > 0 && (
                                <tr>
                                    <td className="label">Discount ({discountPercentage.toFixed(0)}%):</td>
                                    <td className="value">-₹{discountAmount.toFixed(2)}</td>
                                </tr>
                            )}
                            <tr className="grand-total"><td className="label">Grand Total:</td><td className="value">₹{grandTotalAfterDiscount.toFixed(2)}</td></tr>
                        </tbody>
                    </table>
                </div>
                {/* <p id='rupee'>₹🆙PhonePe Number: 9829572755 </p> */}
            </div>

            {/* --- THE FINAL ACTION BUTTON --- */}
            <div className="action-section">
                <button className="save-download-btn" onClick={handleSaveAndDownload} disabled={loading}>
                    {loading ? 'Processing...' : (<><DownloadIcon /> Save & Download Bill</>)}
                </button>
            </div>
        </div>
    );
}

export default App;