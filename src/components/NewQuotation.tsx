import React, { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { 
  Quotation, 
  QuotationStatus, 
  QuotationItem, 
  Customer, 
  InventoryItem, 
  CompanyProfile,
  OperationType 
} from '../types';
import { 
  Plus, 
  Minus,
  Trash2, 
  Save, 
  Printer, 
  ChevronLeft, 
  Search, 
  Calculator,
  Loader2,
  FileDown
} from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_BASE64 } from '../assets/logo';
import { cn, formatCurrency, numberToWords } from '../lib/utils';
import { toast } from 'sonner';

interface NewQuotationProps {
  navigateTo: (tab: string, id: string | null) => void;
  quotationId: string | null;
}

export function NewQuotation({ navigateTo, quotationId }: NewQuotationProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  // Form State
  const [quotationNo, setQuotationNo] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [isIGST, setIsIGST] = useState(false);
  const [terms, setTerms] = useState<string[]>(['Subject to Delhi Jurisdiction', 'Immediate Payment']);

  const [previewScale, setPreviewScale] = useState(1);
  const [displayZoom, setDisplayZoom] = useState(36);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateScale = () => {
      if (previewContainerRef.current) {
        // Use getBoundingClientRect for more precise dimensions
        const containerRect = previewContainerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        
        // Tighten padding for mobile to allow a larger 'Fit' view if possible, but keep it clean
        const isMobile = window.innerWidth < 768;
        const hPadding = isMobile ? 16 : 80;
        const vPadding = isMobile ? 32 : 80;
        
        const availableWidth = Math.max(0, containerWidth - hPadding);
        const availableHeight = Math.max(0, containerHeight - vPadding);
        
        const targetWidthPx = 210 * 3.7795; // 210mm to pixels
        const targetHeightPx = 297 * 3.7795; // 297mm to pixels
        
        const widthScale = availableWidth / targetWidthPx;
        const heightScale = availableHeight / targetHeightPx;
        
        // Default fit-to-screen scale
        const nextScale = Math.min(widthScale, heightScale);
        // On mobile, if we are extremely narrow, ensure we don't go too small but keep it fitting
        setPreviewScale(Math.min(nextScale, 1.1)); 
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      // Small delay to ensure layout has shifted
      requestAnimationFrame(updateScale);
    });

    if (previewContainerRef.current) {
      resizeObserver.observe(previewContainerRef.current);
    }
    
    // Also observe the parent to catch flex changes
    if (previewContainerRef.current?.parentElement) {
      resizeObserver.observe(previewContainerRef.current.parentElement);
    }

    updateScale();
    window.addEventListener('resize', updateScale);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  // Pinch-to-Zoom for mobile in the preview container
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    let initialDistance: number | null = null;
    let initialZoomState = displayZoom;

    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches);
        initialZoomState = displayZoom;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance !== null) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches);
        const ratio = currentDistance / initialDistance;
        const nextZoom = Math.min(Math.max(0, Math.round(initialZoomState * ratio)), 100);
        setDisplayZoom(nextZoom);
      }
    };

    const handleTouchEnd = () => {
      initialDistance = null;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [displayZoom]);

  useEffect(() => {
    const generateNewNo = async () => {
      if (!auth.currentUser || !date || loading) return;
      
      try {
        const d = new Date(date);
        const month = d.getMonth(); // 0-11
        const year = d.getFullYear();
        
        // Calculate Financial Year (April to March)
        let fy = '';
        if (month < 3) { // Jan, Feb, Mar
          fy = `${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
        } else {
          fy = `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
        }
        
        const displayMonth = month + 1;
        const prefix = `${fy}/${displayMonth}/`;

        const q = query(
          collection(db, 'quotations'),
          where('userId', '==', auth.currentUser.uid),
          where('quotationNo', '>=', prefix),
          where('quotationNo', '<=', prefix + '\uf8ff')
        );
        
        const snap = await getDocs(q);
        let maxSerial = 0;
        
        snap.docs.forEach(doc => {
          const no = doc.data().quotationNo;
          const parts = no.split('/');
          const serial = parseInt(parts[parts.length - 1]);
          if (!isNaN(serial) && serial > maxSerial) {
            maxSerial = serial;
          }
        });

        const nextSerial = (maxSerial + 1).toString().padStart(3, '0');
        setQuotationNo(`${prefix}${nextSerial}`);
      } catch (error) {
        console.error("Quotation Number Generation Error:", error);
      }
    };

    generateNewNo();
  }, [date, auth.currentUser?.uid, loading, quotationId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      try {
        const [custSnap, invSnap, profSnap] = await Promise.all([
          getDocs(query(collection(db, 'customers'), where('userId', '==', auth.currentUser.uid))),
          getDocs(query(collection(db, 'products'), where('userId', '==', auth.currentUser.uid))),
          getDoc(doc(db, 'companyProfile', auth.currentUser.uid))
        ]);

        setCustomers(custSnap.docs.map(d => {
          const data = d.data();
          return { ...data, id: d.id } as Customer;
        }));
        setInventory(invSnap.docs.map(d => {
          const data = d.data();
          return { ...data, id: d.id } as InventoryItem;
        }));
        
        console.log("Context loaded: ", custSnap.size, "customers,", invSnap.size, "inventory items");
        
        if (profSnap.exists()) {
          setCompanyProfile(profSnap.data() as CompanyProfile);
        }

        if (quotationId) {
          const qSnap = await getDoc(doc(db, 'quotations', quotationId));
          if (qSnap.exists()) {
            const data = qSnap.data() as Quotation;
            // setQuotationNo(data.quotationNo); // We override this now as per requirement
            setSelectedCustomerId(data.customerId);
            setItems(data.items);
            setIsIGST(data.isIGST);
            if (data.termsAndConditions) setTerms(data.termsAndConditions);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [quotationId]);

  const addItem = () => {
    setItems([...items, { 
      productId: '', 
      description: '', 
      hsn: '', 
      qty: 1, 
      rate: 0, 
      taxableValue: 0, 
      gstRate: 18, 
      gstAmount: 0, 
      total: 0 
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, updates: Partial<QuotationItem>) => {
    const newItems = [...items];
    const item = { ...newItems[index], ...updates };
    
    item.taxableValue = Number((item.qty * item.rate).toFixed(2));
    
    if (isIGST) {
      item.gstAmount = Number((item.taxableValue * item.gstRate / 100).toFixed(2));
    } else {
      const halfRate = item.gstRate / 2;
      const cgst = Number((item.taxableValue * halfRate / 100).toFixed(2));
      const sgst = Number((item.taxableValue * halfRate / 100).toFixed(2));
      item.gstAmount = Number((cgst + sgst).toFixed(2));
    }
    
    item.total = Number((item.taxableValue + item.gstAmount).toFixed(2));
    
    newItems[index] = item;
    setItems(newItems);
  };

  useEffect(() => {
    setItems(prev => prev.map(item => {
      const taxableValue = Number((item.qty * item.rate).toFixed(2));
      let gstAmount = 0;
      if (isIGST) {
        gstAmount = Number((taxableValue * item.gstRate / 100).toFixed(2));
      } else {
        const halfRate = item.gstRate / 2;
        const cgst = Number((taxableValue * halfRate / 100).toFixed(2));
        const sgst = Number((taxableValue * halfRate / 100).toFixed(2));
        gstAmount = Number((cgst + sgst).toFixed(2));
      }
      return {
        ...item,
        taxableValue,
        gstAmount,
        total: Number((taxableValue + gstAmount).toFixed(2))
      };
    }));
  }, [isIGST]);

  const generateProfessionalPDF = async () => {
    if (!selectedCustomer || !companyProfile) {
      toast.error('Identity Mismatch: Please ensure customer and company profile are loaded');
      return;
    }

    setSaving(true);
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);

      // Helper for Base64 from URL
      const getBase64FromUrl = async (url: string): Promise<string> => {
        const data = await fetch(url);
        const blob = await data.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => resolve(reader.result as string);
        });
      };

      // 1. Draw Section Borders (Side borders)
      doc.setDrawColor(0);
      doc.setLineWidth(0.25);
      
      // Top horizontal line
      doc.line(margin, margin, pageWidth - margin, margin);

      // 2. Header Section
      const headerH = 55;
      const logoBoxW = contentWidth * 0.35;
      const infoBoxW = contentWidth * 0.65;
      
      // Draw Header Boxes (Vertical lines for header)
      doc.line(margin, margin, margin, margin + headerH); // Left edge
      doc.line(pageWidth - margin, margin, pageWidth - margin, margin + headerH); // Right edge
      doc.line(margin, margin + headerH, pageWidth - margin, margin + headerH); // Bottom edge
      doc.line(margin + logoBoxW, margin, margin + logoBoxW, margin + headerH); // Divider

      // Logo Box Content
      try {
        const logoUrl = "https://3.imimg.com/data3/BA/DB/MY-10927644/atom-aviation-service-logo.png";
        const base64 = await getBase64FromUrl(logoUrl);
        doc.addImage(base64, 'PNG', margin + (logoBoxW / 2) - 15, margin + 5, 30, 30);
      } catch (e) {
        console.warn("Logo load failed:", e);
      }
      
      const companyName = companyProfile.name.toUpperCase();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      const logoBoxText = doc.splitTextToSize(companyName, logoBoxW - 4);
      doc.text(logoBoxText, margin + (logoBoxW / 2), margin + 40, { align: 'center' });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("WE UNDERSTAND YOUR REQUIREMENTS", margin + (logoBoxW / 2), margin + 48, { align: 'center' });

      // Info Box Content
      const rightX = margin + logoBoxW;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const infoBoxText = doc.splitTextToSize(companyName, infoBoxW - 4);
      doc.text(infoBoxText, rightX + (infoBoxW / 2), margin + 6, { align: 'center' });
      doc.line(rightX, margin + 11, pageWidth - margin, margin + 11);

      doc.setFontSize(9);
      const addressLines = doc.splitTextToSize(companyProfile.address.toUpperCase(), infoBoxW - 10);
      doc.text(addressLines, rightX + (infoBoxW / 2), margin + 17, { align: 'center' });
      doc.line(rightX, margin + 30, pageWidth - margin, margin + 30);

      const contactInfo = `Tel: ${companyProfile.phone}, Email: ${companyProfile.email}`;
      const totalWidth = doc.getTextWidth(contactInfo);
      const telPart = `Tel: ${companyProfile.phone}, Email: `;
      const telWidth = doc.getTextWidth(telPart);
      const emailWidth = doc.getTextWidth(companyProfile.email);
      const startX = (rightX + (infoBoxW / 2)) - (totalWidth / 2);

      doc.text(contactInfo, rightX + (infoBoxW / 2), margin + 36, { align: 'center' });
      doc.link(startX + telWidth, margin + 36 - 3, emailWidth, 4, { url: `mailto:${companyProfile.email}` });
      doc.line(rightX, margin + 42, pageWidth - margin, margin + 42);

      doc.setFontSize(10);
      doc.text(`GSTIN: ${companyProfile.gstin || '07AANCA1860C2ZW'}, PAN No : ${companyProfile.pan || 'AANCA1860C'}`, rightX + (infoBoxW / 2), margin + 49, { align: 'center' });

      // 3. Title Row
      let currentY = margin + headerH;
      doc.setFillColor(218, 232, 252); 
      doc.rect(margin, currentY, contentWidth, 12, 'F');
      doc.rect(margin, currentY, contentWidth, 12, 'S');
      
      // Side borders for Title row
      doc.line(margin, currentY, margin, currentY + 12);
      doc.line(pageWidth - margin, currentY, pageWidth - margin, currentY + 12);

      doc.setFontSize(22);
      doc.setFont("times", "bold");
      doc.text("QUOTATION", pageWidth / 2, currentY + 8.5, { align: 'center' });
      currentY += 12;

      // 4. Meta Info Row
      const metaH = 12;
      doc.line(margin, currentY + metaH, pageWidth - margin, currentY + metaH);
      doc.line(pageWidth / 2, currentY, pageWidth / 2, currentY + metaH);
      
      // Side borders for Meta row
      doc.line(margin, currentY, margin, currentY + metaH);
      doc.line(pageWidth - margin, currentY, pageWidth - margin, currentY + metaH);

      // Labels
      doc.setFontSize(9);
      doc.text(`Quotation No:- ${quotationNo}`, margin + 2, currentY + 5);
      doc.text(`Date: ${date ? format(new Date(date), 'dd-MMM-yyyy') : ''}`, margin + 2, currentY + 10);
      
      doc.text(`Name :- ${selectedCustomer.name.toUpperCase()}`, pageWidth / 2 + 2, currentY + 5);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text("INDIA", pageWidth / 2 + 2, currentY + 8.5);
      if (selectedCustomer.gstin) {
        doc.setFontSize(7);
        doc.text(`GSTIN: ${selectedCustomer.gstin}`, pageWidth / 2 + 2, currentY + 11.5);
      }
      
      currentY += metaH;

      // 5. Table
      const tableData = items.map((item, idx) => {
        const gstRateLabel = isIGST ? `${item.gstRate}%` : `${item.gstRate/2}% CGST\n${item.gstRate/2}% SGST`;
        const gstAmountLabel = isIGST 
          ? item.gstAmount.toFixed(2)
          : `${(item.gstAmount/2).toFixed(2)}\n${(item.gstAmount/2).toFixed(2)}`;

        return [
          idx + 1,
          item.description.toUpperCase(),
          item.hsn,
          item.qty,
          item.rate.toFixed(2),
          item.taxableValue.toFixed(2),
          gstRateLabel,
          gstAmountLabel,
          item.total.toFixed(2)
        ];
      });

      // Add empty rows to maintain professional grid length
      if (tableData.length < 5) {
        const emptyCount = 5 - tableData.length;
        for (let i = 0; i < emptyCount; i++) {
          tableData.push(['', '', '', '', '', '', '', '', '']);
        }
      }

      autoTable(doc, {
        startY: currentY,
        head: [
          [
            { content: 'S. No.', rowSpan: 2 },
            { content: 'Product Description', rowSpan: 2 },
            { content: 'HSN/SAC code', rowSpan: 2 },
            { content: 'Qty', rowSpan: 2 },
            { content: 'Rate', rowSpan: 2 },
            { content: 'Taxable Value', rowSpan: 2 },
            { content: 'GST', colSpan: 2 },
            { content: 'Total', rowSpan: 2 }
          ],
          ['Rate(%)', 'Amount']
        ],
        body: tableData,
        theme: 'grid',
        styles: {
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          fontSize: 7,
          cellPadding: 1,
          font: "helvetica",
          textColor: 0,
          valign: 'middle'
        },
        headStyles: {
          fillColor: [218, 232, 252],
          fontStyle: 'bold',
          textColor: 0,
          halign: 'center'
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'left' },
          2: { halign: 'center', cellWidth: 18 },
          3: { halign: 'center', cellWidth: 10 },
          4: { halign: 'right', cellWidth: 18 },
          5: { halign: 'right', cellWidth: 18 },
          6: { halign: 'center', cellWidth: 15 },
          7: { halign: 'right', cellWidth: 15 },
          8: { halign: 'right', fontStyle: 'bold', cellWidth: 25 }
        },
        foot: [[
          { content: 'Total', colSpan: 3, styles: { fontStyle: 'bold', halign: 'left' } },
          items.reduce((a, b) => a + b.qty, 0),
          '',
          totals.taxable.toFixed(2),
          '',
          totals.gst.toFixed(2),
          totals.total.toFixed(2)
        ]],
        footStyles: {
          fillColor: [218, 232, 252],
          textColor: 0,
          fontStyle: 'bold',
          lineWidth: 0.25
        },
        margin: { left: margin, right: margin }
      });

      currentY = (doc as any).lastAutoTable.finalY;

      // 6. Footer - Bank & Amount in Words
      const footerH = 25;
      doc.line(margin, currentY, pageWidth - margin, currentY); 
      doc.line(margin, currentY + footerH, pageWidth - margin, currentY + footerH); 
      doc.line(margin + 90, currentY, margin + 90, currentY + footerH); 
      
      // Side borders for Footer row
      doc.line(margin, currentY, margin, currentY + footerH);
      doc.line(pageWidth - margin, currentY, pageWidth - margin, currentY + footerH);

      // Left: Bank
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`A/C :- ${companyProfile.name.toUpperCase()}`, margin + 2, currentY + 4);
      doc.text(`BANK NAME: ${companyProfile.bankDetails.bankName.toUpperCase()}`, margin + 2, currentY + 9);
      doc.text(`Bank A/C: ${companyProfile.bankDetails.accountNumber}`, margin + 2, currentY + 14);
      doc.text(`Bank IFSC: ${companyProfile.bankDetails.ifsc.toUpperCase()}`, margin + 2, currentY + 19);
      doc.text(`BRANCH: ${companyProfile.bankDetails.branch.toUpperCase()}`, margin + 2, currentY + 24);

      // Right: Amount in words
      const wordsBoxX = margin + 90;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bolditalic");
      doc.text("Amount in words", wordsBoxX + (contentWidth - 90) / 2, currentY + 4, { align: 'center' });
      doc.line(wordsBoxX, currentY + 6, pageWidth - margin, currentY + 6);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const words = numberToWords(Math.round(totals.total));
      const wordsLines = doc.splitTextToSize(words, contentWidth - 95);
      doc.text(wordsLines, wordsBoxX + (contentWidth - 90) / 2, currentY + 15, { align: 'center' });

      currentY += footerH;

      // 7. Terms and Signature
      const termsH = 35;
      doc.line(margin, currentY, pageWidth - margin, currentY); 
      doc.line(margin, currentY + termsH, pageWidth - margin, currentY + termsH); 
      doc.line(margin + 130, currentY, margin + 130, currentY + termsH); 
      
      // Side borders for Terms row
      doc.line(margin, currentY, margin, currentY + termsH);
      doc.line(pageWidth - margin, currentY, pageWidth - margin, currentY + termsH);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Terms & conditions", margin + 2, currentY + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      terms.forEach((t, i) => {
        doc.text(`${i + 1}. ${t}`, margin + 2, currentY + 10 + (i * 5));
      });

      // Signature Box
      if (companyProfile.stampUrl) {
        try {
          const stampBase64 = await getBase64FromUrl(companyProfile.stampUrl);
          const stampW = 28;
          const stampH = 28;
          const stampX = margin + 130 + (contentWidth - 130) / 2 - (stampW / 2);
          const stampY = currentY + 2; 
          doc.addImage(stampBase64, 'PNG', stampX, stampY, stampW, stampH);
        } catch (e) {
          console.warn("Stamp load failed:", e);
        }
      }
      
      doc.setFont("helvetica", "bold");
      doc.text("AUTHORIZED SIGNATORY", margin + 130 + (contentWidth - 130) / 2, currentY + 32, { align: 'center' });

      doc.save(`Quotation_${quotationNo}.pdf`);
      toast.success('Document exported successfully.');
    } catch (error) {
      console.error("PDF Gen Error:", error);
      toast.error("Failed to generate PDF. Check console for details.");
    } finally {
      setSaving(false);
    }
  };


  const handleShare = () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer first');
      return;
    }
    
    generateProfessionalPDF();
  };

  const selectProduct = (index: number, productId: string) => {
    const product = inventory.find(p => p.id === productId);
    if (product) {
      updateItem(index, {
        productId,
        description: product.name,
        hsn: product.hsn,
        rate: product.rate,
      });
    }
  };

  const totals = items.reduce((acc, item) => ({
    taxable: Number((acc.taxable + item.taxableValue).toFixed(2)),
    gst: Number((acc.gst + item.gstAmount).toFixed(2)),
    total: Number((acc.total + item.total).toFixed(2))
  }), { taxable: 0, gst: 0, total: 0 });

  const handleSave = async (status: QuotationStatus) => {
    if (!auth.currentUser || !selectedCustomerId) {
      toast.error('Please select a customer');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setSaving(true);
    const customer = customers.find(c => c.id === selectedCustomerId);
    
    const quotationData: Quotation = {
      userId: auth.currentUser.uid,
      quotationNo,
      date,
      customerId: selectedCustomerId,
      customerName: customer?.name || '',
      items,
      totalTaxableValue: totals.taxable,
      totalGstAmount: totals.gst,
      grandTotal: totals.total,
      isIGST,
      status,
      termsAndConditions: terms,
      createdAt: quotationId ? '' : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      if (quotationId) {
        const { createdAt, ...rest } = quotationData;
        await updateDoc(doc(db, 'quotations', quotationId), rest);
        toast.success('Quotation updated');
      } else {
        await addDoc(collection(db, 'quotations'), quotationData);
        toast.success('New quotation created');
      }
      navigateTo('quotations', null);
    } catch (error) {
      toast.error('Failed to save quotation');
      handleFirestoreError(error, OperationType.WRITE, 'quotations');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="animate-spin text-slate-400 w-8 h-8" />
      <p className="text-slate-400 font-medium animate-pulse">Synchronizing Record...</p>
    </div>
  );

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigateTo('quotations', null)} 
            className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{quotationId ? 'Edit Quotation' : 'New Estimate'}</h2>
            <p className="text-slate-500 text-sm">Professional Proposal System</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => handleShare()}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Share / Print
          </button>
          <button 
            onClick={() => handleSave(QuotationStatus.DRAFT)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-900 text-slate-900 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-600 font-bold text-xs uppercase tracking-widest transition-all"
          >
            <Save className="w-4 h-4" />
            Draft
          </button>
          <button 
            disabled={saving}
            onClick={() => handleSave(QuotationStatus.SENT)}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-blue-600 font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Finalize
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-8">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-2">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <Search className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[11px]">Primary Credentials</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Document Index No</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 md:py-3 font-mono text-base md:text-sm text-slate-700 focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all outline-none"
                  value={quotationNo}
                  onChange={(e) => setQuotationNo(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Issuance Date</label>
                <input 
                  type="date" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 md:py-3 text-base md:text-sm text-slate-700 focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all outline-none"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target Entity (Customer)</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 md:py-3 text-base md:text-sm text-slate-800 font-semibold focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all outline-none appearance-none"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
              >
                <option value="">Select an identified contact...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
              <input 
                type="checkbox" 
                id="isIGST" 
                className="w-5 h-5 text-slate-900 rounded-lg border-slate-300 focus:ring-slate-900 transition-all cursor-pointer"
                checked={isIGST}
                onChange={(e) => setIsIGST(e.target.checked)}
              />
              <label htmlFor="isIGST" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                Inter-state Transaction (IGST)
              </label>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[11px]">Billable Items</h3>
              </div>
              <button 
                onClick={addItem}
                className="text-[11px] font-bold text-slate-900 hover:text-blue-600 flex items-center gap-2 bg-slate-50 hover:bg-blue-50 px-4 py-2 rounded-lg border border-slate-100 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> ADD NEW LINE
              </button>
            </div>

            <div className="space-y-6">
              {items.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                  <p className="text-slate-400 italic text-sm">No items added to this quotation yet.</p>
                </div>
              ) : (
                items.map((item, idx) => (
                  <div key={idx} className="p-6 bg-slate-50/50 rounded-2xl border border-slate-200 relative group animate-in slide-in-from-top-2 duration-300">
                    <button 
                      onClick={() => removeItem(idx)}
                      className="absolute -top-3 -right-3 w-8 h-8 bg-white border border-rose-100 shadow-sm rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all z-10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="sm:col-span-3">
                          <label className="text-[9px] uppercase text-slate-400 font-bold tracking-widest mb-1 block">Entity Selector</label>
                          <select 
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 md:py-2.5 text-base md:text-sm font-medium text-slate-700"
                            value={item.productId}
                            onChange={(e) => selectProduct(idx, e.target.value)}
                          >
                            <option value="">Select Inventory...</option>
                            {inventory.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] uppercase text-slate-400 font-bold tracking-widest mb-1 block">HSN Code</label>
                          <input 
                            type="text"
                            placeholder="HSN"
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 md:py-2.5 text-base md:text-sm font-mono text-slate-600"
                            value={item.hsn}
                            onChange={(e) => updateItem(idx, { hsn: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase text-slate-400 font-bold tracking-widest block">Description / Configuration Lines</label>
                        <textarea 
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-base md:text-sm text-slate-700 h-24 font-sans"
                          placeholder="Detailed specifications, bullet points, etc."
                          value={item.description}
                          onChange={(e) => updateItem(idx, { description: e.target.value })}
                        />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4 items-end">
                        <div>
                          <label className="text-[9px] uppercase text-slate-400 font-bold tracking-widest mb-1 block">Quantity</label>
                          <input 
                            type="number"
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 md:py-2.5 text-base md:text-sm font-semibold"
                            value={item.qty}
                            onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase text-slate-400 font-bold tracking-widest mb-1 block">Unit Rate</label>
                          <input 
                            type="number"
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 md:py-2.5 text-base md:text-sm font-semibold"
                            value={item.rate}
                            onChange={(e) => updateItem(idx, { rate: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase text-slate-400 font-bold tracking-widest mb-1 block">Tax Slab (%)</label>
                          <select 
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 md:py-2.5 text-base md:text-sm font-semibold"
                            value={item.gstRate}
                            onChange={(e) => updateItem(idx, { gstRate: Number(e.target.value) })}
                          >
                            <option value={0}>NIL</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </div>
                        <div className="text-right flex flex-col justify-end h-full">
                          <p className="text-[9px] uppercase text-slate-400 font-bold tracking-widest mb-1">Row Total</p>
                          <p className="font-mono font-bold text-slate-800 text-sm">{formatCurrency(item.total)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-8 pt-6 border-t font-medium space-y-2 border-slate-100">
               <div className="flex justify-between text-slate-400 text-xs">
                 <span>Subtotal (Taxable)</span>
                 <span className="font-mono">{formatCurrency(totals.taxable)}</span>
               </div>
               <div className="flex justify-between text-slate-400 text-xs">
                 <span>Combined Tax (GST)</span>
                 <span className="font-mono">{formatCurrency(totals.gst)}</span>
               </div>
               <div className="flex justify-between text-slate-900 text-lg font-bold pt-2">
                 <span className="tracking-tight uppercase text-sm">Grand Total</span>
                 <span className="font-mono">{formatCurrency(totals.total)}</span>
               </div>
            </div>
          </section>
        </div>

        <div className="lg:sticky lg:top-8 h-[75vh] lg:h-[calc(100vh-6rem)] w-full rounded-3xl border border-slate-200 shadow-2xl bg-slate-500/5 p-1 overflow-hidden relative group/preview">
          {/* Zoom Controls Overlay - ALWAYS VISIBLE */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-full shadow-xl z-50 transition-all duration-300">
            <button 
              onClick={() => setDisplayZoom(prev => Math.max(0, prev - 5))}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors active:scale-95"
              title="Zoom Out"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="text-[11px] font-black text-slate-600 w-14 text-center select-none font-mono">
              {displayZoom}%
            </div>
            <button 
              onClick={() => setDisplayZoom(prev => Math.min(100, prev + 5))}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors active:scale-95"
              title="Zoom In"
            >
              <Plus className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <button 
              onClick={() => { setDisplayZoom(36); }}
              className="text-[10px] font-black text-blue-600 hover:text-blue-700 px-3 py-1 rounded-full hover:bg-blue-50 transition-colors uppercase tracking-tight"
            >
              Fit
            </button>
          </div>

          <div 
            id="pdf-preview-container"
            ref={previewContainerRef}
            className={`w-full h-full bg-white rounded-[22px] flex flex-col items-center bg-slate-100 px-2 py-8 md:px-8 md:py-12 custom-scrollbar transition-all ${displayZoom > 36 ? 'overflow-auto justify-start' : 'overflow-hidden justify-center'}`}
          >
            <div 
              ref={printRef} 
              className="w-[210mm] min-h-[297mm] p-[20mm] bg-white text-[10px] text-black leading-tight font-sans shadow-2xl shrink-0 origin-top transition-transform duration-300 ease-out"
              style={{ 
                transform: `scale(${previewScale * (displayZoom / 36)})`,
                marginBottom: displayZoom > 36 ? 0 : `calc(-297mm * (1 - (${previewScale * (displayZoom / 36)})))`
              }}
            >
              {/* HEADER SECTION - EXACT MATCH TO REFERENCE */}
              <div className="flex border border-black w-full">
                <div className="w-[35%] py-3 flex flex-col items-center justify-center border-r border-black px-2 bg-white">
                   {/* Logo - TOP LEFT POSITIONED */}
                   <div className="w-full flex justify-center mb-2">
                      <img 
                        src={companyProfile?.logoUrl || "https://www.atomaviation.com/wp-content/uploads/2021/04/Atom-Logo.png"} 
                        alt="Logo" 
                        className="h-16 w-auto object-contain"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = '<div class="text-xl font-black italic text-center p-2 border-2 border-slate-900 rounded-lg">ATOM<br/>AVIATION</div>';
                          }
                        }}
                      />
                   </div>
                   <div className="text-center px-1">
                     <p className="text-[9px] font-black uppercase tracking-tight leading-tight">{companyProfile?.name || 'ATOM AVIATION SERVICES'}</p>
                     <p className="text-[7px] font-bold text-slate-600 uppercase tracking-tighter mt-0.5">WE UNDERSTAND YOUR REQUIREMENTS</p>
                   </div>
                </div>
                <div className="w-[65%] flex flex-col font-bold">
                  <div className="p-2 border-b border-black text-center uppercase text-[11px] font-black leading-tight flex items-center justify-center min-h-[40px]">
                    {companyProfile?.name || 'ATOM AVIATION SERVICES PRIVATE LIMITED'}
                  </div>
                  <div className="p-2 text-[10px] text-center border-b border-black uppercase leading-tight font-black flex-1 flex items-center justify-center">
                    {companyProfile?.address || 'E-523,3RD FLOOR, RAMPHAL CHOWK, DWARKA SEC-7, NEW DELHI'}
                  </div>
                  <div className="p-1 border-b border-black text-[9px] flex justify-center items-center gap-4">
                    <span className="font-black">Tel: {companyProfile?.phone}</span>
                    <span className="font-black">Email: {companyProfile?.email}</span>
                  </div>
                  <div className="p-1.5 flex justify-center gap-8 text-[9px] font-black">
                    <span>GSTIN: {companyProfile?.gstin}</span>
                    <span>PAN No : {companyProfile?.pan}</span>
                  </div>
                </div>
              </div>

              {/* QUOTATION TITLE BANNER */}
              <div className="bg-[#dae8fc] border-x border-b border-black py-3 text-center font-serif font-black text-3xl tracking-normal uppercase leading-none">
                QUOTATION
              </div>

              {/* META INFO SECTION */}
              <div className="flex border-x border-b border-black font-bold text-[10px]">
                <div className="w-1/2 border-r border-black flex flex-col">
                  <div className="flex border-b border-black flex-1">
                    <div className="w-28 bg-slate-50 p-1.5 border-r border-black uppercase text-[9px] font-black flex items-center">Quotation No:-</div>
                    <div className="p-1.5 flex-1 font-black flex items-center">{quotationNo}</div>
                  </div>
                  <div className="flex flex-1">
                    <div className="w-28 bg-slate-50 p-1.5 border-r border-black uppercase text-[9px] font-black flex items-center">Date</div>
                    <div className="p-1.5 flex-1 font-black flex items-center">{date ? format(new Date(date), 'dd-MMM-yyyy') : ''}</div>
                  </div>
                </div>
                <div className="w-1/2 flex">
                  <div className="w-28 bg-slate-50 p-1.5 border-r border-black uppercase text-[9px] font-black flex items-center">Name :-</div>
                  <div className="p-1.5 flex-1 font-black uppercase flex flex-col justify-center">
                    <div className="text-sm leading-tight">{selectedCustomer?.name || 'SELECT CUSTOMER'}</div>
                    <div className="text-[9px] mt-0.5 text-slate-600 font-bold tracking-tight">INDIA</div>
                    {selectedCustomer?.gstin && (
                      <div className="text-[8px] mt-0.5 text-blue-900 font-black">GSTIN: {selectedCustomer.gstin}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* MAIN TABLE */}
              <table className="w-full border-x border-b border-black text-[10px] border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: '10mm' }} />
                  <col />
                  <col style={{ width: '18mm' }} />
                  <col style={{ width: '10mm' }} />
                  <col style={{ width: '18mm' }} />
                  <col style={{ width: '18mm' }} />
                  <col style={{ width: '15mm' }} />
                  <col style={{ width: '15mm' }} />
                  <col style={{ width: '25mm' }} />
                </colgroup>
                <thead>
                  <tr className="bg-[#dae8fc]">
                    <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-black uppercase text-[9px]">S. No.</th>
                    <th rowSpan={2} className="border-r border-b border-black px-2 py-1 text-center font-black uppercase text-[9px]">Product Description</th>
                    <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-black uppercase text-[9px]">HSN/SAC code</th>
                    <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-black uppercase text-[9px]">Qty</th>
                    <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-black uppercase text-[9px] text-right">Rate</th>
                    <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-black uppercase text-[9px] text-right">Taxable Value</th>
                    <th colSpan={2} className="border-r border-b border-black py-1 font-black uppercase text-[9px]">GST</th>
                    <th rowSpan={2} className="border-b border-black px-1 py-1 font-black uppercase text-[9px] text-right">Total</th>
                  </tr>
                  <tr className="bg-[#dae8fc]">
                    <th className="border-r border-b border-black py-1 font-black text-[8px] uppercase">Rate(%)</th>
                    <th className="border-r border-b border-black py-1 font-black text-[8px] uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="align-top font-bold">
                      <td className="border-r border-black p-2 text-center border-b">{idx + 1}</td>
                      <td className="border-r border-black p-2 border-b">
                        <div className="font-black uppercase text-[10px] whitespace-pre-wrap leading-tight">{item.description}</div>
                      </td>
                      <td className="border-r border-black p-2 text-center font-black border-b">{item.hsn}</td>
                      <td className="border-r border-black p-2 text-center font-black border-b">{item.qty}</td>
                      <td className="border-r border-black p-2 text-right border-b">{item.rate.toFixed(2)}</td>
                      <td className="border-r border-black p-2 text-right font-black border-b">{item.taxableValue.toFixed(2)}</td>
                      <td className="border-r border-black p-0 border-b">
                        <div className="flex flex-col h-full">
                          {isIGST ? (
                            <div className="flex-1 p-2 text-center font-black flex items-center justify-center">{item.gstRate}%</div>
                          ) : (
                            <>
                              <div className="border-b border-black/10 p-1 text-[8px] text-center font-black uppercase">{item.gstRate/2}% CGST</div>
                              <div className="p-1 text-[8px] text-center font-black uppercase">{item.gstRate/2}% SGST</div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="border-r border-black p-0 border-b">
                        <div className="flex flex-col h-full">
                          {isIGST ? (
                            <div className="flex-1 p-2 text-right font-black flex items-center justify-end">{item.gstAmount.toFixed(2)}</div>
                          ) : (
                            <>
                              <div className="border-b border-black/10 p-1 text-[8px] text-right font-black">{(item.gstAmount/2).toFixed(2)}</div>
                              <div className="p-1 text-[8px] text-right font-black">{(item.gstAmount/2).toFixed(2)}</div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-right font-black border-b">{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  {/* Fill empty rows to maintain professional length */}
                  {items.length < 5 && Array.from({ length: 5 - items.length }).map((_, i) => (
                    <tr key={`empty-${i}`} className="h-8">
                      <td className="border-r border-black border-b"></td>
                      <td className="border-r border-black border-b"></td>
                      <td className="border-r border-black border-b"></td>
                      <td className="border-r border-black border-b"></td>
                      <td className="border-r border-black border-b"></td>
                      <td className="border-r border-black border-b"></td>
                      <td className="border-r border-black border-b"></td>
                      <td className="border-r border-black border-b"></td>
                      <td className="border-b border-black"></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#dae8fc] font-black border-t border-black text-[11px] h-10">
                    <td className="border-r border-black px-2 uppercase" colSpan={3}>Total</td>
                    <td className="border-r border-black px-2 text-center">{items.reduce((a, b) => a + b.qty, 0)}</td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black px-2 text-right">{totals.taxable.toFixed(2)}</td>
                    <td className="border-r border-black px-2 text-right font-black" colSpan={2}>{totals.gst.toFixed(2)}</td>
                    <td className="px-2 text-right font-black">{totals.total.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* FOOTER SECTIONS */}
              <div className="flex border-x border-b border-black font-bold text-[10px]">
                <div className="w-[45%] border-r border-black p-2 space-y-1.5 flex flex-col justify-center">
                  <div className="text-[10px] uppercase font-black border-b border-black pb-1 mb-1">A/C :- {companyProfile?.name || 'ATOM AVIATION SERVICES PVT LTD'}</div>
                  <p className="uppercase">BANK NAME: {companyProfile?.bankDetails.bankName || 'SBI Credit Account'}</p>
                  <p className="uppercase">Bank A/C: {companyProfile?.bankDetails.accountNumber || '44659295667'}</p>
                  <p className="uppercase">Bank IFSC: {companyProfile?.bankDetails.ifsc || 'SBIN0011565'}</p>
                  <p className="uppercase">BRANCH: {companyProfile?.bankDetails.branch || 'DWARKA, NEW DELHI'}</p>
                </div>
                <div className="w-[55%] flex flex-col">
                   <div className="bg-slate-50 border-b border-black p-1 font-black uppercase text-[9px] text-center italic">Amount in words</div>
                   <div className="flex-1 p-3 flex items-center justify-center">
                     <p className="font-black text-center leading-tight uppercase underline underline-offset-4 decoration-slate-400">{numberToWords(Math.round(totals.total))} RUPEES ONLY.</p>
                   </div>
                </div>
              </div>

              {/* TERMS & SIGNATURE */}
              <div className="flex border-x border-b border-black font-bold text-[10px] min-h-[140px]">
                <div className="w-[70%] border-r border-black p-4">
                  <p className="font-black text-[11px] uppercase underline mb-3">Terms & conditions</p>
                  <ol className="space-y-1.5 text-[10px] font-black uppercase">
                    {terms.map((t, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span>{idx + 1}.</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="w-[30%] relative p-2 flex flex-col justify-end items-center bg-slate-50/20">
                   {/* Signatory Stamp - Matching reference style */}
                   {companyProfile?.stampUrl ? (
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-32 h-32 flex items-center justify-center">
                        <img 
                          src={companyProfile.stampUrl} 
                          alt="Stamp" 
                          className="max-w-full max-h-full object-contain rotate-6 opacity-90"
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                        />
                     </div>
                   ) : (
                     <div className="w-28 h-28 absolute top-4 left-1/2 -translate-x-1/2 rotate-12 opacity-90 pointer-events-none">
                        <div className="w-full h-full border-[4px] border-blue-900/40 rounded-full flex items-center justify-center">
                           <div className="text-[8px] text-blue-900/60 font-black text-center leading-tight uppercase px-3">
                             {companyProfile?.name || 'ATOM AVIATION'}<br/>SERVICES PVT LTD<br/><span className="text-[6px]">NEW DELHI</span>
                           </div>
                        </div>
                     </div>
                   )}
                   <div className="w-full border-t border-black pt-2 text-center font-black uppercase text-[10px] relative z-10">
                     AUTHORIZED SIGNATORY
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
