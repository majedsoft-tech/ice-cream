import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  IceCream,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Check,
  RotateCcw,
  Printer,
  Sparkles,
  Coins,
  TrendingUp,
  Store,
  Percent,
  History,
  Scissors,
  DollarSign,
  Undo2,
  ShoppingBag as CartIcon,
  HelpCircle,
  Clock,
  MessageCircle,
  LayoutGrid,
  List,
  Link,
  Settings
} from 'lucide-react';
import { CONTAINER_OPTIONS, FLAVOR_OPTIONS, TOPPING_OPTIONS, DISCOUNTS, DEFAULT_CURRENCY } from './data';
import { ContainerOption, FlavorOption, ToppingOption, CartItem, SaleRecord, OrderDiscount, OnlineOrder } from './types';
import { db, OperationType, handleFirestoreError } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, onSnapshot, writeBatch } from 'firebase/firestore';

const cleanForFirestore = <T,>(obj: T): T => {
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj));
};

export default function App() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'POS' | 'OnlineOrders' | 'OnlineSetup' | 'History' | 'Prices'>('OnlineOrders');

  const [containers, setContainers] = useState<ContainerOption[]>(() => {
    const saved = localStorage.getItem('ice_cream_containers');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading containers pricing', e);
      }
    }
    return CONTAINER_OPTIONS;
  });

  const [flavors, setFlavors] = useState<FlavorOption[]>(() => {
    const saved = localStorage.getItem('ice_cream_flavors');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading flavors pricing', e);
      }
    }
    return FLAVOR_OPTIONS;
  });

  const [toppings, setToppings] = useState<ToppingOption[]>(() => {
    const saved = localStorage.getItem('ice_cream_toppings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading toppings pricing', e);
      }
    }
    return TOPPING_OPTIONS;
  });

  const [isOrdersStopped, setIsOrdersStopped] = useState<boolean>(false);
  
  // Current Item Configuration State
  const [selectedContainer, setSelectedContainer] = useState<ContainerOption>(() => {
    const saved = localStorage.getItem('ice_cream_containers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed[0];
      } catch (e) {}
    }
    return CONTAINER_OPTIONS[0];
  });
  
  const [selectedFlavors, setSelectedFlavors] = useState<FlavorOption[]>(() => {
    const saved = localStorage.getItem('ice_cream_flavors');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return [parsed[0]];
      } catch (e) {}
    }
    return [FLAVOR_OPTIONS[0]];
  });

  const [selectedToppings, setSelectedToppings] = useState<ToppingOption[]>([]);
  const [quantity, setQuantity] = useState<number>(1);

  // --- PRICE UPDATE ACTIONS ---
  const handleUpdatePrice = (category: 'container' | 'flavor' | 'topping', id: string, newPrice: number) => {
    if (newPrice < 0 || isNaN(newPrice)) {
      triggerNotice('عذراً، لا يمكن وضع سعر سالب للمنتجات!', 'error');
      return;
    }

    const fixedPrice = parseFloat(newPrice.toFixed(2));

    if (category === 'container') {
      const updated = containers.map(c => c.id === id ? { ...c, price: fixedPrice } : c);
      setDoc(doc(db, 'settings', 'prices'), {
        containers: updated,
        flavors,
        toppings
      }, { merge: true }).then(() => {
        setSelectedContainer(prev => {
          const fresh = updated.find(c => c.id === prev.id);
          return fresh ? fresh : prev;
        });
        triggerNotice('تم تحديث سعر الوعاء بنجاح ونقله للسحابة!', 'success');
      }).catch(err => {
        console.error("Error setting pricing:", err);
        triggerNotice('حدث خطأ أثناء حفظ السعر بالخادم.', 'error');
        handleFirestoreError(err, OperationType.WRITE, 'settings/prices');
      });
    } else if (category === 'flavor') {
      const updated = flavors.map(f => f.id === id ? { ...f, price: fixedPrice } : f);
      setDoc(doc(db, 'settings', 'prices'), {
        containers,
        flavors: updated,
        toppings
      }, { merge: true }).then(() => {
        setSelectedFlavors(prev => prev.map(p => updated.find(u => u.id === p.id) || p));
        triggerNotice('تم تحديث سعر النكهة بنجاح ونقله للسحابة!', 'success');
      }).catch(err => {
        console.error("Error setting pricing:", err);
        triggerNotice('حدث خطأ أثناء حفظ السعر بالخادم.', 'error');
        handleFirestoreError(err, OperationType.WRITE, 'settings/prices');
      });
    } else if (category === 'topping') {
      const updated = toppings.map(t => t.id === id ? { ...t, price: fixedPrice } : t);
      setDoc(doc(db, 'settings', 'prices'), {
        containers,
        flavors,
        toppings: updated
      }, { merge: true }).then(() => {
        setSelectedToppings(prev => prev.map(p => updated.find(u => u.id === p.id) || p));
        triggerNotice('تم تحديث سعر الإضافة بنجاح ونقله للسحابة!', 'success');
      }).catch(err => {
        console.error("Error setting pricing:", err);
        triggerNotice('حدث خطأ أثناء حفظ السعر بالخادم.', 'error');
        handleFirestoreError(err, OperationType.WRITE, 'settings/prices');
      });
    }
  };

  const handleToggleOrdersStopped = (stopped: boolean) => {
    setDoc(doc(db, 'settings', 'prices'), {
      isOrdersStopped: stopped
    }, { merge: true }).then(() => {
      triggerNotice(stopped ? 'تم إيقاف استقبال الطلبات للموقع كامل 🛑' : 'تم تفعيل استقبال الطلبات للموقع كامل 🟢', 'success');
    }).catch(err => {
      console.error("Error setting orders stopped status:", err);
      triggerNotice('حدث خطأ أثناء تغيير حالة استقبال الطلبات.', 'error');
      handleFirestoreError(err, OperationType.WRITE, 'settings/prices');
    });
  };

  const handleToggleAvailability = (category: 'container' | 'flavor' | 'topping', id: string, currentVal: boolean) => {
    const newVal = !currentVal;
    if (category === 'container') {
      const updated = containers.map(c => c.id === id ? { ...c, isAvailable: newVal } : c);
      setDoc(doc(db, 'settings', 'prices'), {
        containers: updated
      }, { merge: true }).then(() => {
        triggerNotice(`تم تحديث حالة توفر الوعاء بنجاح!`, 'success');
      }).catch(err => {
        console.error("Error setting availability:", err);
        triggerNotice('حدث خطأ أثناء تحديث التوفر بالخادم.', 'error');
        handleFirestoreError(err, OperationType.WRITE, 'settings/prices');
      });
    } else if (category === 'flavor') {
      const updated = flavors.map(f => f.id === id ? { ...f, isAvailable: newVal } : f);
      setDoc(doc(db, 'settings', 'prices'), {
        flavors: updated
      }, { merge: true }).then(() => {
        triggerNotice(`تم تحديث حالة توفر النكهة بنجاح!`, 'success');
      }).catch(err => {
        console.error("Error setting availability:", err);
        triggerNotice('حدث خطأ أثناء تحديث التوفر بالخادم.', 'error');
        handleFirestoreError(err, OperationType.WRITE, 'settings/prices');
      });
    } else if (category === 'topping') {
      const updated = toppings.map(t => t.id === id ? { ...t, isAvailable: newVal } : t);
      setDoc(doc(db, 'settings', 'prices'), {
        toppings: updated
      }, { merge: true }).then(() => {
        triggerNotice(`تم تحديث حالة توفر الإضافة بنجاح!`, 'success');
      }).catch(err => {
        console.error("Error setting availability:", err);
        triggerNotice('حدث خطأ أثناء تحديث التوفر بالخادم.', 'error');
        handleFirestoreError(err, OperationType.WRITE, 'settings/prices');
      });
    }
  };

  const handleResetAllPrices = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في استعادة جميع الأسعار الافتراضية؟')) {
      setDoc(doc(db, 'settings', 'prices'), {
        containers: CONTAINER_OPTIONS,
        flavors: FLAVOR_OPTIONS,
        toppings: TOPPING_OPTIONS
      }).then(() => {
        setSelectedContainer(CONTAINER_OPTIONS[0]);
        setSelectedFlavors([FLAVOR_OPTIONS[0]]);
        setSelectedToppings([]);
        triggerNotice('تم استعادة جميع الأسعار الافتراضية سحابياً!', 'success');
      }).catch(err => {
        console.error("Error resetting pricing:", err);
        triggerNotice('حدث خطأ أثناء إعادة تعيين الأسعار بالخادم.', 'error');
        handleFirestoreError(err, OperationType.WRITE, 'settings/prices');
      });
    }
  };
  
  // Cart & Cashier State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [manualDiscountVal, setManualDiscountVal] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [bankSubMethod, setBankSubMethod] = useState<string>('stc');
  const [tenderedAmount, setTenderedAmount] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');

  // --- SEGREGATED CUSTOMER SELF-ORDER STATES ---
  const [viewMode, setViewMode] = useState<'seller' | 'customer'>(() => {
    return (window.location.hash === '#/seller' || window.location.hash === '#seller') ? 'seller' : 'customer';
  });
  const [customerCart, setCustomerCart] = useState<CartItem[]>([]);
  const [selfCustomerName, setSelfCustomerName] = useState<string>('');
  const [recentOnlineOrderId, setRecentOnlineOrderId] = useState<string | null>(() => {
    return localStorage.getItem('recent_online_order_id') || null;
  });
  const [activeCustomerOrder, setActiveCustomerOrder] = useState<OnlineOrder | null>(null);

  const [custPaymentMethod, setCustPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [custBankSubMethod, setCustBankSubMethod] = useState<string>('stc');

  // Dynamic customer customization options
  const [custContainer, setCustContainer] = useState<ContainerOption | null>(null);
  const [custFlavors, setCustFlavors] = useState<FlavorOption[]>([]);
  const [custToppings, setCustToppings] = useState<ToppingOption[]>([]);
  const [custQuantity, setCustQuantity] = useState<number>(1);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState<boolean>(false);

  useEffect(() => {
    if (containers.length > 0 && custContainer) {
      const updated = containers.find(c => c.id === custContainer.id);
      if (updated) {
        setCustContainer(updated);
      }
    }
  }, [containers]);

  useEffect(() => {
    if (recentOnlineOrderId) {
      const unsub = onSnapshot(doc(db, 'online_orders', recentOnlineOrderId), (snap) => {
        if (snap.exists()) {
          setActiveCustomerOrder(snap.data() as OnlineOrder);
        } else {
          setActiveCustomerOrder(null);
        }
      });
      return () => unsub();
    } else {
      setActiveCustomerOrder(null);
    }
  }, [recentOnlineOrderId]);

  // --- ONLINE ORDERS MAIN POS STATE ---
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const [onlineViewLayout, setOnlineViewLayout] = useState<'grid' | 'list'>('list');
  const [previousPendingCount, setPreviousPendingCount] = useState<number>(0);
  
  // Sales Ledger State
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([]);
  const [completedOrder, setCompletedOrder] = useState<SaleRecord | null>(null);

  // Sales Ledger Filters State
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [ledgerPaymentMethodFilter, setLedgerPaymentMethodFilter] = useState<string>('all');
  const [ledgerContainerFilter, setLedgerContainerFilter] = useState<string>('all');
  const [ledgerSourceFilter, setLedgerSourceFilter] = useState<'all' | 'pos' | 'online'>('all');

  const filteredSalesHistory = salesHistory.filter(sale => {
    // 1. Search Query filter (matches order number, customer name, flavors, container, toppins, etc)
    const matchesSearch = ledgerSearch.trim() === '' || (
      sale.orderNumber.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      (sale.customerName && sale.customerName.toLowerCase().includes(ledgerSearch.toLowerCase())) ||
      sale.items.some(item => 
        item.container.name.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        item.flavors.some(f => f.name.toLowerCase().includes(ledgerSearch.toLowerCase())) ||
        item.toppings.some(t => t.name.toLowerCase().includes(ledgerSearch.toLowerCase()))
      )
    );

    // 2. Payment Method filter
    let matchesPayment = true;
    if (ledgerPaymentMethodFilter !== 'all') {
      if (ledgerPaymentMethodFilter === 'cash') {
        matchesPayment = sale.paymentMethod === 'cash';
      } else if (ledgerPaymentMethodFilter === 'card') {
        matchesPayment = sale.paymentMethod === 'card';
      } else {
        // specific bank sub method (stc, barq, urpay, other)
        matchesPayment = sale.paymentMethod === 'card' && sale.bankSubMethod === ledgerPaymentMethodFilter;
      }
    }

    // 3. Container filter
    const matchesContainer = ledgerContainerFilter === 'all' || sale.items.some(item => item.container.id === ledgerContainerFilter);

    // 4. Source Filter (Kashier / Self-Service Online)
    let matchesSource = true;
    if (ledgerSourceFilter !== 'all') {
      const isSaleOnline = sale.isOnline || sale.calculatedDiscountName?.includes('أونلاين');
      if (ledgerSourceFilter === 'online') {
        matchesSource = !!isSaleOnline;
      } else if (ledgerSourceFilter === 'pos') {
        matchesSource = !isSaleOnline;
      }
    }

    return matchesSearch && matchesPayment && matchesContainer && matchesSource;
  });

  // Generate WhatsApp message URL
  const getWhatsAppUrl = (order: SaleRecord) => {
    let text = `*فاتورة مبيعات آيس كريم 🍦*\n\n`;
    if (order.customerName) {
      text += `*العميل:* ${order.customerName}\n`;
    }
    text += `*رقم المحاسبة:* ${order.orderNumber}\n`;
    text += `*وقت الشراء:* ${order.timestamp}\n`;
    text += `--------------------------------\n`;

    order.items.forEach((item, index) => {
      text += `*${index + 1}. ${item.container.name}* × ${item.quantity}\n`;
      text += `• نكهات: ${item.flavors.map(f => f.emoji || '').join('')} ${item.flavors.map(f => f.name).join('، ')}\n`;
      if (item.toppings.length > 0) {
        text += `• إضافات: ${item.toppings.map(t => t.name).join(' + ')}\n`;
      }
      text += `• السعر: ${item.itemTotal.toFixed(2)} ريال\n\n`;
    });

    text += `--------------------------------\n`;
    text += `*المجموع الفرعي للآيس كريم:* ${order.subtotal.toFixed(2)} ريال\n`;
    if (order.toppingsTotal > 0) {
      text += `*إجمالي الإضافات المميزة:* +${order.toppingsTotal.toFixed(2)} ريال\n`;
    }
    if (order.discountAmount > 0) {
      text += `*الخصومات المقتطعة:* -${order.discountAmount.toFixed(2)} ريال\n* تفاصيل الخصم:* ${order.calculatedDiscountName}\n`;
    }
    text += `*الحساب الإجمالي المقبوض:* ${order.total.toFixed(2)} ريال\n`;

    const methodText = order.paymentMethod === 'cash'
      ? 'نقداً / كاش'
      : `تحويل بنكي (${
          order.bankSubMethod === 'stc'
            ? 'STC Pay'
            : order.bankSubMethod === 'barq'
            ? 'barq'
            : order.bankSubMethod === 'urpay'
            ? 'urpay'
            : order.bankSubMethod === 'other'
            ? 'بنك آخر'
            : 'تحويل بنكي'
        })`;
    text += `*طريقة الدفع:* ${methodText}\n`;

    if (order.paymentMethod === 'cash') {
      text += `*المستلم من العميل:* ${(order.receivedAmount || 0).toFixed(2)} ريال\n`;
      text += `*المرتجع للعميل (الباقي):* ${(order.changeAmount || 0).toFixed(2)} ريال\n`;
    }
    
    text += `--------------------------------\n`;
    text += `شكرًا لزيارتكم! نتمنى لكم يومًا مليئاً بالبهجة والسعادة ✨🍦`;

    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  };


  // Sound/haptics feedback simulator
  const [alertMessage, setAlertMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // --- FIREBASE REAL-TIME SYNC ---
  useEffect(() => {
    // 1. Subscribe to "settings/prices" document
    const unsubPrices = onSnapshot(doc(db, 'settings', 'prices'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.containers) {
          setContainers(data.containers);
          localStorage.setItem('ice_cream_containers', JSON.stringify(data.containers));
        }
        if (data.flavors) {
          setFlavors(data.flavors);
          localStorage.setItem('ice_cream_flavors', JSON.stringify(data.flavors));
        }
        if (data.toppings) {
          setToppings(data.toppings);
          localStorage.setItem('ice_cream_toppings', JSON.stringify(data.toppings));
        }
        setIsOrdersStopped(data.isOrdersStopped || false);
      } else {
        // Doc doesn't exist yet, populate with default options
        setDoc(doc(db, 'settings', 'prices'), {
          containers: CONTAINER_OPTIONS,
          flavors: FLAVOR_OPTIONS,
          toppings: TOPPING_OPTIONS,
          isOrdersStopped: false
        }).catch(err => {
          console.error("Error creating initial prices doc:", err);
          handleFirestoreError(err, OperationType.WRITE, 'settings/prices');
        });
      }
    }, (error) => {
      console.error("Error listening to prices settings:", error);
      handleFirestoreError(error, OperationType.GET, 'settings/prices');
    });

    // 2. Subscribe to "sales" collection
    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      const historyList: SaleRecord[] = [];
      snapshot.forEach((docSnap) => {
        historyList.push(docSnap.data() as SaleRecord);
      });
      // Sort sales by timestamp descending to match the local behavior
      historyList.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setSalesHistory(historyList);
      localStorage.setItem('ice_cream_sales_history', JSON.stringify(historyList));
    }, (error) => {
      console.error("Error listening to sales history:", error);
      handleFirestoreError(error, OperationType.LIST, 'sales');
    });

    // 3. Subscribe to "online_orders" collection
    const unsubOnlineOrders = onSnapshot(collection(db, 'online_orders'), (snapshot) => {
      const ordersList: OnlineOrder[] = [];
      snapshot.forEach((docSnap) => {
        ordersList.push(docSnap.data() as OnlineOrder);
      });
      // Sort: Newest timestamp first (newest order first)
      ordersList.sort((a, b) => {
        const timeA = a.createdAt || (a.id && a.id.startsWith('ONLINE-') ? parseInt(a.id.replace('ONLINE-', '')) : 0) || 0;
        const timeB = b.createdAt || (b.id && b.id.startsWith('ONLINE-') ? parseInt(b.id.replace('ONLINE-', '')) : 0) || 0;
        return timeB - timeA;
      });
      setOnlineOrders(ordersList);
    }, (error) => {
      console.error("Error listening to online orders:", error);
      handleFirestoreError(error, OperationType.LIST, 'online_orders');
    });

    return () => {
      unsubPrices();
      unsubSales();
      unsubOnlineOrders();
    };
  }, []);

  // Helper notice banner
  const triggerNotice = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setAlertMessage({ text, type });
    setTimeout(() => {
      setAlertMessage(null);
    }, 4000);
  };

  // Web Audio API chime sounds to signal incoming orders
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime); 
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      
      osc.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.15); 
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
    } catch (e) {
      console.log("Audio feedback blocked:", e);
    }
  };

  const pendingCount = useMemo(() => {
    return onlineOrders.filter(o => o.status === 'pending').length;
  }, [onlineOrders]);

  useEffect(() => {
    if (viewMode === 'seller' && pendingCount > previousPendingCount) {
      playChime();
      const latestOrder = onlineOrders.find(o => o.status === 'pending');
      triggerNotice(`📥 تم استلام طلب ذاتي جديد من ${latestOrder?.customerName || 'عميل'} بقيمة ${latestOrder?.total.toFixed(2)} ريال!`, 'info');
    }
    setPreviousPendingCount(pendingCount);
  }, [pendingCount, viewMode, onlineOrders]);

  // Sync hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const mode = (window.location.hash === '#/seller' || window.location.hash === '#seller') ? 'seller' : 'customer';
      setViewMode(mode);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // --- ICE CREAM ITEM PRICING LOGIC ---
  const currentItemPrices = useMemo(() => {
    const containerPrice = selectedContainer.price;
    // Premium flavors calculate extra
    const flavorsPrice = selectedFlavors.reduce((sum, flavor) => sum + flavor.price, 0);
    const toppingsPrice = selectedToppings.reduce((sum, topping) => sum + topping.price, 0);
    const itemUnitBase = containerPrice + flavorsPrice;
    const totalUnit = itemUnitBase + toppingsPrice;
    
    return {
      containerPrice,
      flavorsPrice,
      toppingsPrice,
      itemUnitBase,
      totalUnit,
      totalGroup: totalUnit * quantity
    };
  }, [selectedContainer, selectedFlavors, selectedToppings, quantity]);

  // Handle flavor selection limit to 3 scoops
  const handleFlavorToggle = (flavor: FlavorOption) => {
    setSelectedFlavors(prev => {
      const exists = prev.some(f => f.id === flavor.id);
      if (exists) {
        // Must have at least one flavor
        if (prev.length <= 1) {
          triggerNotice('يجب مِلء الآيس كريم بنكهة واحدة على الأقل!', 'error');
          return prev;
        }
        return prev.filter(f => f.id !== flavor.id);
      } else {
        if (prev.length >= 3) {
          triggerNotice('الحد الأقصى هو 3 نكهات (طابات) متراصة للطلب الواحد!', 'info');
          return prev;
        }
        return [...prev, flavor];
      }
    });
  };

  // Handle toppings selection
  const handleToppingToggle = (topping: ToppingOption) => {
    setSelectedToppings(prev => {
      const exists = prev.some(t => t.id === topping.id);
      if (exists) {
        return prev.filter(t => t.id !== topping.id);
      } else {
        return [...prev, topping];
      }
    });
  };

  // --- ADD TO CART ---
  const handleAddToCart = () => {
    if (selectedFlavors.length === 0) {
      triggerNotice('الرجاء اختيار نكهة واحدة على الأقل للآيس كريم!', 'error');
      return;
    }

    const newItem: CartItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      container: selectedContainer,
      flavors: [...selectedFlavors],
      toppings: [...selectedToppings],
      quantity: quantity,
      basePrice: selectedContainer.price + selectedFlavors.reduce((sum, f) => sum + f.price, 0),
      toppingsPrice: selectedToppings.reduce((sum, t) => sum + t.price, 0),
      itemTotal: currentItemPrices.totalGroup
    };

    setCart(prev => [...prev, newItem]);
    triggerNotice(`تمت إضافة ${quantity} آيس كريم نكهة ${selectedFlavors[0].name} إلى قائمة الطلبات!`, 'success');
    
    // Reset selections for next item but keep container preference
    setSelectedFlavors([flavors[0] || FLAVOR_OPTIONS[0]]);
    setSelectedToppings([]);
    setQuantity(1);
  };

  // Remove from cart
  const handleRemoveFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
    triggerNotice('تمت إزالة المنتج من السلة.', 'info');
  };

  // Clear cart
  const handleClearCart = () => {
    setCart([]);
    setManualDiscountVal(0);
    setTenderedAmount('');
    setCustomerName('');
    triggerNotice('تم إفراغ السلة بالكامل.', 'info');
  };

  // --- DISCOUNTS & TOTALS CALCULATIONS ---
  // Subtotals
  const cartTotals = useMemo(() => {
    const productsSubtotal = cart.reduce((sum, item) => sum + (item.basePrice * item.quantity), 0);
    const toppingsSubtotal = cart.reduce((sum, item) => sum + (item.toppingsPrice * item.quantity), 0);
    const subtotal = productsSubtotal + toppingsSubtotal;
    const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    // --- AUTOMATIC DIVERSITY AND QUANTITY DISCOUNT ---
    // Rule: "خصم الطلبات المتنوعة":
    // 1. If user buys 3 or more total cups/cones -> 10% Discount
    // 2. OR, if they order at least one Cup and at least one Cone inside the same order (Diverse order) -> 12% Discount!
    let autoDiscountPercent = 0;
    let autoDiscountName = '';

    const hasCup = cart.some(item => item.container.id === 'cup');
    const hasCone = cart.some(item => item.container.id === 'cone');
    const hasDifferentFlavors = cart.length > 1;

    if (hasCup && hasCone) {
      autoDiscountPercent = 12;
      autoDiscountName = 'خصم الطلب المتنوع (كوب + بسكوت)';
    } else if (totalItemsCount >= 3) {
      autoDiscountPercent = 10;
      autoDiscountName = 'خصم الكمية الكبيرة (3 قطع فأكثر)';
    } else if (hasDifferentFlavors) {
      autoDiscountPercent = 5;
      autoDiscountName = 'خصم تشكيلة نكهات سريعة';
    }

    const autoDiscountAmount = (subtotal * autoDiscountPercent) / 100;

    // Manual Selected Discount
    const manualDiscountAmount = Math.min(manualDiscountVal, subtotal - autoDiscountAmount);

    const totalDiscounts = autoDiscountAmount + manualDiscountAmount;
    const finalTotal = Math.max(0, subtotal - totalDiscounts);

    return {
      productsSubtotal,
      toppingsSubtotal,
      subtotal,
      totalItemsCount,
      autoDiscountPercent,
      autoDiscountName,
      autoDiscountAmount,
      manualDiscountAmount,
      totalDiscounts,
      finalTotal
    };
  }, [cart, manualDiscountVal]);

  // Automatically populate tenderedAmount with the net total as a default value
  useEffect(() => {
    if (cartTotals.finalTotal > 0) {
      setTenderedAmount(cartTotals.finalTotal.toFixed(2));
    } else {
      setTenderedAmount('');
    }
  }, [cartTotals.finalTotal]);

  // Calculate change due
  const changeDue = useMemo(() => {
    const cash = parseFloat(tenderedAmount) || 0;
    if (cash <= 0 || cash < cartTotals.finalTotal) return 0;
    return cash - cartTotals.finalTotal;
  }, [tenderedAmount, cartTotals.finalTotal]);

  // Quick cash addition helper
  const handleQuickCash = (amount: number) => {
    const current = parseFloat(tenderedAmount) || 0;
    setTenderedAmount((current === 0 ? amount : current + amount).toString());
  };

  // --- SUBMIT COMPLETED SALE ---
  const handleCompleteCheckout = () => {
    if (cart.length === 0) {
      triggerNotice('لا يمكن إتمام البيع، السلة فارغة!', 'error');
      return;
    }

    const cashReceived = parseFloat(tenderedAmount) || 0;
    if (paymentMethod === 'cash' && cashReceived < cartTotals.finalTotal) {
      triggerNotice('المبلغ المدفوع أقل من قيمة الفاتورة الإجمالية!', 'error');
      return;
    }

    const orderNum = `ORD-${Date.now().toString().slice(-6)}`;
    
    // Concat discount names
    let discountsApplied = [];
    if (cartTotals.autoDiscountAmount > 0) {
      discountsApplied.push(cartTotals.autoDiscountName);
    }
    if (manualDiscountVal > 0) {
      discountsApplied.push(`خصم يدوي خارجي (${manualDiscountVal.toFixed(2)} ر.س)`);
    }
    const discountNameString = discountsApplied.join(' + ') || 'لا يوجد';

    const newSale: SaleRecord = {
      id: `${Date.now()}`,
      orderNumber: orderNum,
      timestamp: new Date().toLocaleString('ar-SA', { hour12: true }),
      items: [...cart],
      subtotal: cartTotals.subtotal,
      toppingsTotal: cartTotals.toppingsSubtotal,
      discountAmount: cartTotals.totalDiscounts,
      calculatedDiscountName: discountNameString,
      total: cartTotals.finalTotal,
      paymentMethod,
      receivedAmount: paymentMethod === 'cash' ? cashReceived : cartTotals.finalTotal,
      changeAmount: paymentMethod === 'cash' ? (cashReceived - cartTotals.finalTotal) : 0,
      bankSubMethod: paymentMethod === 'card' ? bankSubMethod : undefined,
      customerName: customerName.trim() || undefined
    };

    setDoc(doc(db, 'sales', newSale.id), cleanForFirestore(newSale))
      .then(() => {
        // Show thermal receipt modal
        setCompletedOrder(newSale);
        
        // Spark and state reset
        setCart([]);
        setManualDiscountVal(0);
        setTenderedAmount('');
        setCustomerName('');
        triggerNotice(`تم إتمام الفاتورة ${orderNum} بنجاح ونقلها للسحابة!`, 'success');
      })
      .catch((err) => {
        console.error("Error saving sale to Firebase:", err);
        triggerNotice('عذراً، حدث خطأ أثناء حفظ الفاتورة على السحابة.', 'error');
        handleFirestoreError(err, OperationType.WRITE, `sales/${newSale.id}`);
      });
  };

  // --- ONLINE ORDERS WORKFLOW ACTIONS ---
  const handleAcceptOnlineOrder = async (orderId: string) => {
    try {
      await setDoc(doc(db, 'online_orders', orderId), { status: 'accepted' }, { merge: true });
      triggerNotice('تم قبول الطلب الذاتي وجاري تحضيره في المطبخ! 👨‍🍳', 'success');
    } catch (e) {
      console.error(e);
      triggerNotice('عذراً، حدث خطأ أثناء قبول الطلب بالسحابة.', 'error');
    }
  };

  const handlePrepareOnlineOrder = async (order: OnlineOrder) => {
    try {
      // 1. Mark status as 'prepared'
      await setDoc(doc(db, 'online_orders', order.id), { status: 'prepared' }, { merge: true });

      // 2. Automatically register it to the completed sales history so statistics updates live!
      const saleId = `${Date.now()}`;
      const newSale: SaleRecord = {
        id: saleId,
        orderNumber: order.orderNumber,
        timestamp: new Date().toLocaleString('ar-SA', { hour12: true }),
        items: order.items,
        subtotal: order.subtotal,
        toppingsTotal: order.toppingsTotal,
        discountAmount: (order.subtotal + order.toppingsTotal) - order.total,
        calculatedDiscountName: 'طلب خدمة ذاتية (أونلاين)',
        total: order.total,
        paymentMethod: order.paymentMethod || 'cash',
        bankSubMethod: order.paymentMethod === 'card' ? (order.bankSubMethod || 'stc') : undefined,
        receivedAmount: order.total,
        changeAmount: 0,
        customerName: order.customerName,
        isOnline: true
      };
      await setDoc(doc(db, 'sales', saleId), cleanForFirestore(newSale));

      triggerNotice(`تم تحضير الطلب ${order.orderNumber} لـ ${order.customerName} ودمجه بالمبيعات! 🔔🌟`, 'success');
    } catch (e) {
      console.error(e);
      triggerNotice('عذراً، حدث خطأ أثناء تجهيز الطلب ودمجه سحابياً.', 'error');
    }
  };

  const handleCancelOnlineOrder = async (orderId: string) => {
    if (window.confirm('هل تريد إلغاء هذا الطلب الأونلاين؟')) {
      try {
        await setDoc(doc(db, 'online_orders', orderId), { status: 'cancelled' }, { merge: true });
        triggerNotice('تم إلغاء الطلب وتحويل حالته إلى ملغى.', 'info');
      } catch (e) {
        console.error(e);
        triggerNotice('خطأ أثناء إلغاء الطلب بالخادم.', 'error');
      }
    }
  };

  const handleDeleteOnlineOrder = async (orderId: string, orderNumber: string) => {
    if (window.confirm(`هل أنت متأكد من حذف الطلب الأونلاين رقم ${orderNumber} نهائياً؟`)) {
      try {
        await deleteDoc(doc(db, 'online_orders', orderId));
        triggerNotice(`تم حذف الطلب رقم ${orderNumber} بنجاح من السحابة.`, 'success');
      } catch (e) {
        console.error(e);
        triggerNotice('عذراً، حدث خطأ أثناء حذف طلب الأونلاين.', 'error');
        handleFirestoreError(e, OperationType.DELETE, `online_orders/${orderId}`);
      }
    }
  };

  const handleClearProcessedOnlineOrders = async () => {
    const processedOrders = onlineOrders.filter(o => o.status === 'prepared' || o.status === 'cancelled');
    if (processedOrders.length === 0) {
      triggerNotice('لا توجد طلبات مكتملة أو ملغاة لحذفها حالياً.', 'info');
      return;
    }
    if (window.confirm(`هل تريد حذف جميع الطلبات المكتملة أو الملغاة عدد (${processedOrders.length}) نهائياً؟`)) {
      try {
        const batch = writeBatch(db);
        processedOrders.forEach(o => {
          batch.delete(doc(db, 'online_orders', o.id));
        });
        await batch.commit();
        triggerNotice('تم تنظيف قائمة طلبات الأونلاين وحذف الطلبات المنتهية والمستلمة بنجاح! 🧹✨', 'success');
      } catch (e) {
        console.error(e);
        triggerNotice('عذراً، حدث خطأ أثناء تنظيف طلبات الأونلاين.', 'error');
      }
    }
  };

  // --- CLIENT SELF-SERVICE TOTALS & CART ACTIONS ---
  const customerTotals = useMemo(() => {
    const subtotal = customerCart.reduce((sum, item) => sum + (item.basePrice * item.quantity), 0);
    const toppingsSubtotal = customerCart.reduce((sum, item) => sum + (item.toppingsPrice * item.quantity), 0);
    const total = subtotal + toppingsSubtotal;
    const totalItemsCount = customerCart.reduce((sum, item) => sum + item.quantity, 0);

    // Apply auto discounts same as POS!
    let autoDiscountPercent = 0;
    let autoDiscountName = '';
    const hasCup = customerCart.some(item => item.container.id === 'cup');
    const hasCone = customerCart.some(item => item.container.id === 'cone');
    const hasDifferentFlavors = customerCart.length > 1;

    if (hasCup && hasCone) {
      autoDiscountPercent = 12;
      autoDiscountName = 'خصم الطلب المتنوع (كوب + بسكوت)';
    } else if (totalItemsCount >= 3) {
      autoDiscountPercent = 10;
      autoDiscountName = 'خصم الكمية الكبيرة (3 قطع فأكثر)';
    } else if (hasDifferentFlavors) {
      autoDiscountPercent = 5;
      autoDiscountName = 'خصم تشكيلة نكهات سريعة';
    }

    const autoDiscountAmount = (total * autoDiscountPercent) / 100;
    const finalTotal = Math.max(0, total - autoDiscountAmount);

    return {
      subtotal,
      toppingsSubtotal,
      totalItemsCount,
      autoDiscountPercent,
      autoDiscountName,
      autoDiscountAmount,
      finalTotal
    };
  }, [customerCart]);

   const handleAddCustItemToCart = () => {
    if (!custContainer) {
      triggerNotice('الرجاء اختيار نوع وعاء التقديم والتركيب أولاً لتخصيص كوبك! 🍨', 'error');
      return;
    }
    if (custFlavors.length === 0) {
      triggerNotice('الرجاء اختيار نكهة واحدة على الأقل لكوكبة الآيس كريم! 🍦', 'error');
      return;
    }

    const basePrice = custContainer.price + custFlavors.reduce((sum, f) => sum + f.price, 0);
    const toppingsPrice = custToppings.reduce((sum, t) => sum + t.price, 0);

    const newItem: CartItem = {
      id: `CUST-ITEM-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      container: custContainer,
      flavors: [...custFlavors],
      toppings: [...custToppings],
      quantity: custQuantity,
      basePrice,
      toppingsPrice,
      itemTotal: (basePrice + toppingsPrice) * custQuantity
    };

    setCustomerCart((prev) => [...prev, newItem]);
    
    // Clear customizer state for next item configuration
    setCustContainer(null);
    setCustFlavors([]);
    setCustToppings([]);
    setCustQuantity(1);
    triggerNotice('تمت إضافة النكهة الفخمة لسلتك! قم بإضافة المزيد أو تأكيد طلبك 🍨✨', 'success');
  };

  const handleRemoveCustItemFromCart = (index: number) => {
    setCustomerCart((prev) => prev.filter((_, i) => i !== index));
    triggerNotice('تمت إزالة الصنف من السلة.', 'info');
  };

  const handleUpdateCustItemQty = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setCustomerCart((prev) => prev.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          quantity: newQty,
          itemTotal: (item.basePrice + item.toppingsPrice) * newQty
        };
      }
      return item;
    }));
  };

  const handleSubmitCustomerOrder = async () => {
    if (selfCustomerName.trim().length < 2) {
      triggerNotice('الرجاء إدخال اسمك الكريم (حرفين على الأقل) لن نتمكن من تجهيز طلبك بدونه! 🌸', 'error');
      return;
    }
    if (customerCart.length === 0) {
      triggerNotice('سلة طلبك فارغة! يرجى تكوين آيس كريم وإضافته أولاً.', 'error');
      return;
    }

    const orderId = `ONLINE-${Date.now()}`;
    const orderNum = `ON-${Date.now().toString().slice(-4)}`;

    const newOnlineOrder: OnlineOrder = {
      id: orderId,
      orderNumber: orderNum,
      customerName: selfCustomerName.trim(),
      timestamp: new Date().toLocaleString('ar-SA', { hour12: true }),
      createdAt: Date.now(),
      items: [...customerCart],
      subtotal: customerCart.reduce((sum, item) => sum + (item.basePrice * item.quantity), 0),
      toppingsTotal: customerCart.reduce((sum, item) => sum + (item.toppingsPrice * item.quantity), 0),
      total: customerTotals.finalTotal,
      status: 'pending',
      paymentMethod: custPaymentMethod,
    };

    if (custPaymentMethod === 'card') {
      newOnlineOrder.bankSubMethod = custBankSubMethod;
    }

    try {
      await setDoc(doc(db, 'online_orders', orderId), cleanForFirestore(newOnlineOrder));
      localStorage.setItem('recent_online_order_id', orderId);
      setRecentOnlineOrderId(orderId);
      setCustomerCart([]);
      setIsCartOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      triggerNotice('تم إرسال طلبك السحابي للمطبخ بنجاح! 🚀 تمتع بمشاهدة حالة التحضير الحية.', 'success');
    } catch (e: any) {
      console.error('Customer Order Submit Error:', e);
      const errMsg = e instanceof Error ? e.message : String(e);
      triggerNotice(`عذراً، تعذر إرسال الطلب: ${errMsg}`, 'error');
      try {
        handleFirestoreError(e, OperationType.WRITE, `online_orders/${orderId}`);
      } catch (err) {
        // Log formatted JSON
      }
    }
  };

  const handleCancelRecentCustomerOrder = async () => {
    if (!recentOnlineOrderId) return;
    try {
      await setDoc(doc(db, 'online_orders', recentOnlineOrderId), { status: 'cancelled' }, { merge: true });
      localStorage.removeItem('recent_online_order_id');
      setRecentOnlineOrderId(null);
      setActiveCustomerOrder(null);
      setIsCancelConfirmOpen(false);
      triggerNotice('تم إلغاء طلبك بنجاح.', 'info');
    } catch (e) {
      console.error(e);
      triggerNotice('خطأ أثناء إلغاء الطلب السحابي.', 'error');
    }
  };

  const handleStartNewCustomerOrder = () => {
    localStorage.removeItem('recent_online_order_id');
    setRecentOnlineOrderId(null);
    setActiveCustomerOrder(null);
    setSelfCustomerName('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRefreshOrderStatus = async () => {
    if (!recentOnlineOrderId) return;
    try {
      const snap = await getDoc(doc(db, 'online_orders', recentOnlineOrderId));
      if (snap.exists()) {
        setActiveCustomerOrder(snap.data() as OnlineOrder);
        triggerNotice('تم تحديث حالة الطلب من السحابة بنجاح! 🔄', 'success');
      } else {
        setActiveCustomerOrder(null);
        triggerNotice('لم يتم العثور على هذا الطلب في السحابة.', 'info');
      }
    } catch (e) {
      console.error(e);
      triggerNotice('عذراً، تعذر تحديث الحالة يرجى التأكد من اتصال الإنترنت.', 'error');
    }
  };

  // --- HISTORIC STATISTICS ---
  const salesStats = useMemo(() => {
    let totalRevenue = 0;
    let itemsSold = 0;
    let cupCount = 0;
    let coneCount = 0;
    let totalDiscountsGiven = 0;
    let onlineOrdersCount = 0;
    let onlineRevenue = 0;
    let posOrdersCount = 0;

    salesHistory.forEach(sale => {
      totalRevenue += sale.total;
      totalDiscountsGiven += sale.discountAmount;

      const isSaleOnline = sale.isOnline || sale.calculatedDiscountName?.includes('أونلاين');
      if (isSaleOnline) {
        onlineOrdersCount += 1;
        onlineRevenue += sale.total;
      } else {
        posOrdersCount += 1;
      }

      sale.items.forEach(item => {
        itemsSold += item.quantity;
        if (item.container.id === 'cup') cupCount += item.quantity;
        if (item.container.id === 'cone') coneCount += item.quantity;
      });
    });

    return {
      totalRevenue,
      itemsSold,
      cupCount,
      coneCount,
      totalDiscountsGiven,
      ordersCount: salesHistory.length,
      onlineOrdersCount,
      onlineRevenue,
      posOrdersCount
    };
  }, [salesHistory]);

  const handleClearHistory = async () => {
    if (window.confirm('هل أنت متأكد من رغبتك في تصفير وحذف سجل المبيعات بالكامل؟ لا يمكن التراجع عن هذا الإجراء.')) {
      try {
        triggerNotice('جاري مسح تاريخ المبيعات من السحابة...', 'info');
        const q = query(collection(db, 'sales'));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);
        querySnapshot.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
        triggerNotice('تم مسح سجل المبيعات بالكامل من السحابة وباقي الأجهزة!', 'info');
      } catch (err) {
        console.error("Error clearing sales history:", err);
        triggerNotice('حدث خطأ أثناء مسح سجل المبيعات بالكامل.', 'error');
        handleFirestoreError(err, OperationType.DELETE, 'sales');
      }
    }
  };

  const handleRefundSale = async (saleId: string, orderNo: string) => {
    if (window.confirm(`هل تريد إرجاع الطلب رقم ${orderNo} وإلغاء مبيعاته التاريخية؟`)) {
      try {
        await deleteDoc(doc(db, 'sales', saleId));
        triggerNotice(`تم استرجاع الطلب ${orderNo} بنجاح وحذفه من السحابة.`, 'info');
      } catch (err) {
        console.error("Error refunding sale:", err);
        triggerNotice('حدث خطأ أثناء إلغاء المبيعة بالسحابة.', 'error');
        handleFirestoreError(err, OperationType.DELETE, `sales/${saleId}`);
      }
    }
  };

  if (viewMode === 'customer') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-amber-50/50 text-slate-800 font-sans antialiased pb-12 select-none border-8 border-white" dir="rtl">
        {/* Decorative Ice Cream Border Accent */}
        <div className="h-2 bg-gradient-to-r from-pink-500 via-amber-400 to-emerald-400" />

        {/* --- NOTIFICATION TOAST --- */}
        <AnimatePresence>
          {alertMessage && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-11/12 p-4 rounded-2xl shadow-xl border-4 flex items-center justify-between text-right"
              style={{
                backgroundColor: alertMessage.type === 'success' ? '#F0FDF4' : alertMessage.type === 'error' ? '#FEF2F2' : '#F0F9FF',
                borderColor: alertMessage.type === 'success' ? '#16A34A' : alertMessage.type === 'error' ? '#DC2626' : '#2563EB',
                color: alertMessage.type === 'success' ? '#166534' : alertMessage.type === 'error' ? '#991B1B' : '#075985',
                boxShadow: '6px 6px 0px 0px rgba(30,41,59,0.1)'
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {alertMessage.type === 'success' ? '✨' : alertMessage.type === 'error' ? '⚠️' : 'ℹ️'}
                </span>
                <p className="font-black text-sm leading-relaxed">{alertMessage.text}</p>
              </div>
              <button 
                onClick={() => setAlertMessage(null)} 
                className="text-xs font-black px-2 py-1 hover:bg-black/5 rounded-lg mr-4 transition"
              >
                إغلاق
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- APP HEADER --- */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b-2 border-pink-100/80 shadow-[0_2px_15px_-3px_rgba(236,72,153,0.08)] py-3 px-4 animate-fadeIn">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 relative">
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-11 h-11 bg-pink-500 rounded-2xl flex items-center justify-center text-2xl font-black shadow-sm shrink-0">
                🍦
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black text-pink-600 tracking-tight leading-none uppercase">سحر الآيس كريم</h1>
                  <span className="bg-emerald-100 text-emerald-600 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-150">الطلب الذاتي</span>
                </div>
                <p className="text-pink-400 font-bold text-[10px] sm:text-xs mt-1 font-sans">ركب آيس كريم أحلامك وأرسله للمطبخ! ✨</p>
              </div>
            </div>

            {/* Header Interactive Cart Button */}
            {(!recentOnlineOrderId || !activeCustomerOrder || activeCustomerOrder.status === 'prepared' || activeCustomerOrder.status === 'cancelled') && (
              <button
                type="button"
                id="cart-overlay-button"
                onClick={() => {
                  setIsCartOpen(!isCartOpen);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="relative flex items-center gap-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white font-black px-3.5 py-2.5 rounded-xl border-b-2 border-pink-707 cursor-pointer hover:bg-pink-600 hover:shadow-md transition active:scale-95 duration-200 shrink-0 self-center"
              >
                <div className="relative">
                  <ShoppingBag className="w-4 h-4" />
                  {customerCart.length > 0 && (
                    <motion.div
                      key={customerCart.reduce((sum, item) => sum + item.quantity, 0)}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute -top-2.5 -left-2.5 bg-yellow-400 text-slate-900 border border-white w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-black shadow-sm"
                    >
                      {customerCart.reduce((sum, item) => sum + item.quantity, 0)}
                    </motion.div>
                  )}
                </div>
                <div className="text-right flex flex-col leading-tight font-sans">
                  <span className="text-[8px] font-extrabold text-pink-100">سلة طلباتي</span>
                  <span className="text-[10px] font-black">{customerTotals.finalTotal.toFixed(2)} ر.س</span>
                </div>
              </button>
            )}
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 mt-4 relative">
          {isOrdersStopped && !(recentOnlineOrderId && activeCustomerOrder) ? (
            /* --- ONLINE ORDERS STOPPED SCREEN --- */
            <div className="max-w-xl mx-auto bg-white rounded-3xl p-10 border-4 border-slate-800 shadow-[8px_8px_0px_rgba(30,41,59,0.1)] text-center space-y-6 my-12 font-sans">
              <div className="text-6xl animate-bounce">🍨🛑</div>
              <h2 className="text-2xl font-black text-rose-600">نعتذر منكم، استقبال الطلبات متوقف حالياً</h2>
              <p className="text-sm font-bold text-slate-500 leading-relaxed">
                قام فريق العمل بإيقاف استقبال الطلبات السحابية والخدمة الذاتية مؤقتاً لتخفيف الضغط أو لانتهاء ساعات العمل الرسمية.
              </p>
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                <span className="text-xs font-black text-amber-800 block">✨ نسعد دائماً بخدمتكم وتلبية رغباتكم قريباً جداً! ✨</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold">يمكنك تجديد الصفحة أو زيارتنا لاحقاً لمعاودة الطلب الفوري.</p>
            </div>
          ) : recentOnlineOrderId && activeCustomerOrder ? (
            /* --- SUBMITTED ORDER LIVE STATUS DIALOG --- */
            <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 border-4 border-slate-800 shadow-[8px_8px_0px_rgba(30,41,59,0.1)] space-y-6">
              <div className="text-center space-y-3">
                <span className="text-6.5xl inline-block animate-bounce">
                  {activeCustomerOrder.status === 'pending' ? '🕒' :
                   activeCustomerOrder.status === 'accepted' ? '👨‍🍳' :
                   activeCustomerOrder.status === 'prepared' ? '✨🎉' : '😔'}
                </span>
                <h2 className="text-2xl font-black text-slate-800">مرحباً بك ونورتنا {activeCustomerOrder.customerName}!</h2>
                <p className="text-xs text-slate-400 font-bold">الحالة المباشرة لطلبك رقم <span className="font-mono text-pink-600 font-black">{activeCustomerOrder.orderNumber}</span></p>
              </div>

              {/* Status Stepper visualization */}
              <div className="grid grid-cols-3 gap-2 py-4 relative">
                {/* Connector lines behind */}
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0" />
                
                {[
                  { key: 'pending', emoji: '🕒', name: 'تم الإرسال', desc: 'في قائمة الانتظار' },
                  { key: 'accepted', emoji: '👨‍🍳', name: 'قيد التحضير', desc: 'بدأنا بصناعته' },
                  { key: 'prepared', emoji: '🎉', name: 'جاهز للاستلام', desc: 'تفضل بزيارتنا!' }
                ].map((step, i) => {
                  const isCurrent = activeCustomerOrder.status === step.key;
                  const isPassed = (step.key === 'pending' && (activeCustomerOrder.status === 'accepted' || activeCustomerOrder.status === 'prepared')) ||
                                 (step.key === 'accepted' && activeCustomerOrder.status === 'prepared');
                  
                  return (
                    <div key={step.key} className="relative z-10 flex flex-col items-center text-center">
                      <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center text-lg transition duration-300 ${
                        isCurrent
                          ? 'bg-pink-500 border-pink-600 text-white shadow-lg scale-110 animate-pulse'
                          : isPassed
                          ? 'bg-emerald-500 border-emerald-600 text-white'
                          : 'bg-white border-slate-200 text-slate-300'
                      }`}>
                        <span>{step.emoji}</span>
                      </div>
                      <span className={`text-xs font-black mt-2 ${isCurrent ? 'text-pink-600' : isPassed ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {step.name}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold block mt-0.5">{step.desc}</span>
                    </div>
                  );
                })}
              </div>

              {/* Status Message board */}
              <div className="bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl text-center">
                {activeCustomerOrder.status === 'pending' && (
                  <p className="text-sm font-black text-amber-600 animate-pulse">🕒 طلبك الآن بانتظار موافقة البائع في لوحة التحكم... نرجو الانتظار ثوانٍ معدودة!</p>
                )}
                {activeCustomerOrder.status === 'accepted' && (
                  <p className="text-sm font-black text-blue-600">👨‍🍳 تم قبول طلبك وبدأ صانع الآيس كريم بتجهيز المكونات والألوان الجميلة حالاً! جهز كاشك أو بطاقتك 💳</p>
                )}
                {activeCustomerOrder.status === 'prepared' && (
                  <div className="space-y-2">
                    <p className="text-base font-black text-emerald-650 animate-bounce">🍦✨ طلبك البارد الرائع جاهز ومكتمل للاستلام في طابور المحل! هنيئاً وعافية مقدماً.</p>
                    <p className="text-xs text-slate-550 font-bold">يرجى تمرير رقم طلبك <span className="font-mono text-pink-600 font-extrabold">{activeCustomerOrder.orderNumber}</span> للبائع وسداد القيمة {activeCustomerOrder.total.toFixed(2)} ر.س واستلام الآيس كريم!</p>
                  </div>
                )}
                {activeCustomerOrder.status === 'cancelled' && (
                  <p className="text-sm font-black text-red-600">😔 نعتذر منك بشدة! لقد تم إلغاء أو تعذر استلام طلبك هذا من قبل الإدارة لحالات طارئة.</p>
                )}
              </div>

              {/* Order contents breakdown */}
              <div className="border-t border-dashed border-slate-200 pt-6 space-y-4 select-text font-sans">
                <span className="font-black text-sm text-slate-700 block text-right border-r-4 border-pink-500 pr-2">ملخص طلبك المصمم:</span>
                <div className="space-y-3 font-sans">
                  {activeCustomerOrder.items.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="space-y-1">
                        <span className="font-black text-slate-800 text-sm">{item.container.name} ×{item.quantity}</span>
                        <div className="text-[11px] text-slate-500 font-bold">
                          🥣 كرات الطعم: {item.flavors.map(f => `${f.emoji} ${f.name}`).join(' ، ')}
                        </div>
                        {item.toppings.length > 0 && (
                          <div className="text-[11px] text-emerald-600 font-black">
                            ✨ تزيين بـ: {item.toppings.map(t2 => `${t2.emoji} ${t2.name}`).join(' + ')}
                          </div>
                        )}
                      </div>
                      <span className="font-mono font-black text-slate-700 text-sm shrink-0">{(item.basePrice + item.toppingsPrice) * item.quantity} ريال</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-between items-center text-sm font-black text-slate-800">
                  <span>المبلغ الإجمالي المطلق للدفع:</span>
                  <span className="text-lg font-mono text-pink-600">{activeCustomerOrder.total.toFixed(2)} ريال سعودي</span>
                </div>

                <div className="flex justify-between items-center text-xs font-bold text-slate-500 border-t border-dashed pt-3 mt-1">
                  <span>طريقة الدفع المرفقة:</span>
                  <span className="text-xs font-black text-slate-800">
                    {activeCustomerOrder.paymentMethod === 'card' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span>🏦 تحويل بنكي</span>
                        <span className="bg-pink-100 text-pink-600 px-2 py-0.5 rounded-md text-[10px] font-black">
                          {activeCustomerOrder.bankSubMethod === 'stc' ? 'STC Pay 📱' :
                           activeCustomerOrder.bankSubMethod === 'barq' ? 'barq ⚡' :
                           activeCustomerOrder.bankSubMethod === 'urpay' ? 'urpay 💳' : 'بنك آخر 🏦'}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5" />
                        <span>نقدي / كاش عند الاستلام</span>
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Action trigger buttons */}
              <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 mt-4">
                {/* Manual refresh button - always show to allow immediate check */}
                <button
                  type="button"
                  onClick={handleRefreshOrderStatus}
                  className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs py-3.5 rounded-xl border border-blue-200 transition text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 duration-100"
                >
                  <span>تحديث حالة الطلب يدوياً 🔄</span>
                </button>

                {activeCustomerOrder.status === 'pending' && (
                  !isCancelConfirmOpen ? (
                    <button
                      type="button"
                      onClick={() => setIsCancelConfirmOpen(true)}
                      className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-black text-xs py-3.5 rounded-xl border border-red-200 transition text-center cursor-pointer"
                    >
                      إلغاء الطلب بالكامل ❌
                    </button>
                  ) : (
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-center space-y-3 animate-fadeIn">
                      <p className="text-xs font-black text-red-700">⚠️ هل أنت متأكد من رغبتك في إلغاء طلبك الحالي نهائياً؟ لا يمكن التراجع عن هذا الإجراء!</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCancelRecentCustomerOrder}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-xs py-2.5 rounded-xl transition text-center cursor-pointer shadow-sm"
                        >
                          نعم، إلغاء الطلب ❌
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCancelConfirmOpen(false)}
                          className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border-2 border-slate-200 font-black text-xs py-2.5 rounded-xl transition text-center cursor-pointer"
                        >
                          تراجع وإبقاء الطلب 👍
                        </button>
                      </div>
                    </div>
                  )
                )}

                {(activeCustomerOrder.status === 'pending' || activeCustomerOrder.status === 'accepted') && (
                  <button
                    type="button"
                    onClick={handleStartNewCustomerOrder}
                    className="w-full bg-pink-50 hover:bg-pink-100 text-pink-600 font-extrabold text-xs py-3.5 rounded-xl border border-pink-200 transition text-center cursor-pointer active:scale-95 duration-100"
                  >
                    بدء تصميم آيس كريم جديد 🍦✨
                  </button>
                )}
                
                {(activeCustomerOrder.status === 'prepared' || activeCustomerOrder.status === 'cancelled') && (
                  <button
                    onClick={handleStartNewCustomerOrder}
                    className="w-full bg-pink-500 hover:bg-pink-600 text-white font-black text-xs py-3.5 rounded-xl border-b-4 border-pink-700 hover:border-pink-800 transition text-center shadow-lg cursor-pointer animate-pulse"
                  >
                    صمم آيس كريم جديد الآن! 🍦🚀
                  </button>
                )}
              </div>

            </div>
          ) : isCartOpen ? (
            /* --- CLIENT INLINE SHOPPING CART --- */
            <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
              
              {/* Grid content for Cart Items & Details */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Right/Main Column: Items List */}
                <div className="lg:col-span-7 bg-white rounded-3xl p-6 border-4 border-slate-800 shadow-[8px_8px_0px_rgba(30,41,59,0.1)] space-y-4">
                  <div className="flex justify-between items-center border-b border-pink-100 pb-2">
                    <h3 className="text-xs font-black text-pink-650 border-r-4 border-pink-500 pr-2">١. الأكواب المصممة في سلتك</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCartOpen(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-black px-2.5 py-1.5 rounded-xl border border-slate-200 transition cursor-pointer flex items-center gap-1 active:scale-95"
                    >
                      <span>← العودة للتصميم 🍦</span>
                    </button>
                  </div>
                  
                  {customerCart.length === 0 ? (
                    <div className="text-center py-12 px-4 text-slate-400 space-y-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
                      <span className="text-6xl block animate-bounce">🍨</span>
                      <h4 className="text-xs font-black">سلتك خاوية من السحر والمذاق!</h4>
                      <p className="text-[10px] font-bold max-w-sm mx-auto leading-relaxed">قم بتكوين آيس كريم مخصّص، ثم أضفه للسلة ليكتمل طلبك ويصل للمطبخ.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCartOpen(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 bg-pink-500 hover:bg-pink-600 text-white font-black text-xs px-5 py-3 rounded-xl transition cursor-pointer shadow-md border-b-2 border-pink-700"
                      >
                        ابدأ تصميم آيس كريم جديد 🍧
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {customerCart.map((item, index) => (
                        <div key={index} className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 space-y-3 relative overflow-hidden flex flex-col justify-between">
                          <button
                            onClick={() => handleRemoveCustItemFromCart(index)}
                            className="absolute top-2.5 left-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-black w-7 h-7 rounded-xl transition flex items-center justify-center cursor-pointer border border-red-200 shadow-sm"
                            title="حذف هذا الصنف"
                          >
                            ✕
                          </button>
                          
                          <div className="text-right pl-8">
                            <span className="text-xs font-black text-slate-800 block">{item.container.name}</span>
                            <div className="text-[10px] text-slate-500 font-bold mt-1.5 leading-relaxed">
                              النكهات: {item.flavors.map(f => f.name).join('، ')}
                            </div>
                            {item.toppings.length > 0 && (
                              <div className="text-[10px] text-emerald-600 font-black mt-1 leading-relaxed">
                                إضافات: {item.toppings.map(t3 => t3.name).join(' + ')}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between border-t border-dashed pt-3 mt-1.5 font-sans">
                            {/* Quantity Modifications */}
                            <div className="flex items-center bg-white rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm h-8">
                              <button
                                type="button"
                                onClick={() => handleUpdateCustItemQty(index, item.quantity - 1)}
                                className="w-8 h-full hover:bg-slate-50 text-xs font-extrabold transition text-slate-600"
                              >
                                -
                              </button>
                              <span className="px-3 font-mono text-xs font-black text-slate-800 bg-slate-50/55 h-full flex items-center justify-center border-x border-slate-200 min-w-8">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateCustItemQty(index, item.quantity + 1)}
                                className="w-8 h-full hover:bg-slate-50 text-xs font-extrabold transition text-slate-600"
                              >
                                +
                              </button>
                            </div>

                            <span className="font-mono text-xs font-black text-slate-800">{item.itemTotal.toFixed(2)} ر.س</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Left Column: Shipment Contact Details & Pricing Summary */}
                <div className="lg:col-span-12 xl:col-span-5 space-y-6">
                  
                  {/* Customer Information/Pickup Panel */}
                  <div className="bg-white rounded-3xl p-6 border-4 border-slate-800 shadow-[8px_8px_0px_rgba(30,41,59,0.1)] space-y-4 text-right">
                    <h3 className="text-xs font-black text-pink-650 border-r-4 border-pink-500 pr-2 pb-0.5 font-sans">٢. معلومات الاستلام والدفع</h3>
                    
                    {/* Buyer/Customer Name */}
                    <div className="flex flex-col gap-1.5 font-sans text-xs">
                      <label className="text-[10px] text-slate-400 font-extrabold leading-relaxed" htmlFor="self-customer-name-inline">اسمك الكريم لتسمعه عند مناداة كوبك: *</label>
                      <input
                        type="text"
                        id="self-customer-name-inline"
                        placeholder="اكتب اسم العميل الكريم هنا..."
                        value={selfCustomerName}
                        onChange={(e) => setSelfCustomerName(e.target.value)}
                        className="w-full bg-white border-2 border-slate-300 hover:border-pink-300 focus:border-pink-500 focus:outline-none rounded-2xl px-4 py-3 text-xs font-black text-slate-805 placeholder:text-slate-300 shadow-sm transition"
                      />
                    </div>

                    {/* Customer Payment Options */}
                    <div className="space-y-3 pt-3 border-t border-dashed border-slate-150">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 block mb-2 mr-1">اختر طريقة السداد المفضلة لديك:</span>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setCustPaymentMethod('cash')}
                            className={`py-3 px-4 rounded-xl font-black text-xs transition border-2 flex items-center justify-center gap-2 cursor-pointer ${
                              custPaymentMethod === 'cash'
                                ? 'bg-pink-500 border-pink-600 text-white shadow-md'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-pink-300'
                            }`}
                          >
                            <Coins className="w-4 h-4" />
                            <span>نقدي / كاش</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustPaymentMethod('card')}
                            className={`py-3 px-4 rounded-xl font-black text-xs transition border-2 flex items-center justify-center gap-2 cursor-pointer ${
                              custPaymentMethod === 'card'
                                ? 'bg-pink-500 border-pink-700 text-white shadow-md'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-pink-300'
                            }`}
                          >
                            <span>🏦</span>
                            <span>تحويل بنكي</span>
                          </button>
                        </div>
                      </div>

                      {/* Customer Bank Transfer Sub-options */}
                      {custPaymentMethod === 'card' && (
                        <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3.5 space-y-2.5 font-sans">
                          <span className="text-[10px] font-black text-slate-500 block mr-1">بوابة التحويل المفضلة:</span>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: 'stc', name: 'STC Pay', icon: '📱' },
                              { id: 'barq', name: 'barq', icon: '⚡' },
                              { id: 'urpay', name: 'urpay', icon: '💳' },
                              { id: 'other', name: 'بنك آخر', icon: '🏦' }
                            ].map(sub => {
                              const isSel = custBankSubMethod === sub.id;
                              return (
                                <button
                                  key={sub.id}
                                  type="button"
                                  onClick={() => setCustBankSubMethod(sub.id)}
                                  className={`py-2 px-3 text-[11px] font-black rounded-xl border-2 transition cursor-pointer flex items-center justify-between gap-1 ${
                                    isSel
                                      ? 'bg-pink-500 border-pink-600 text-white shadow-sm'
                                      : 'bg-white border-slate-200 hover:border-pink-300 text-slate-700'
                                  }`}
                                >
                                  <span className="truncate">{sub.name}</span>
                                  <span className="text-sm">{sub.icon}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Calculations breakdown block & Submit */}
                  <div className="bg-white rounded-3xl p-6 border-4 border-slate-800 shadow-[8px_8px_0px_rgba(30,41,59,0.1)] space-y-4 text-right">
                    <h3 className="text-xs font-black text-slate-800 border-r-4 border-slate-400 pr-2 pb-0.5">٣. ملخص الحساب الكلي</h3>
                    
                    <div className="space-y-2.5 font-sans text-xs">
                      <div className="flex justify-between text-slate-500 font-bold">
                        <span>المجموع الفرعي للأكواب:</span>
                        <span className="font-mono">{customerTotals.subtotal.toFixed(2)} ر.س</span>
                      </div>
                      {customerTotals.toppingsSubtotal > 0 && (
                        <div className="flex justify-between text-slate-500 font-bold">
                          <span>ملحقات الإضافات الفخمة:</span>
                          <span className="font-mono">+{customerTotals.toppingsSubtotal.toFixed(2)} ر.س</span>
                        </div>
                      )}
                      {customerTotals.autoDiscountPercent > 0 && (
                        <div className="bg-emerald-50 text-emerald-700 py-2.5 px-3 rounded-xl border border-emerald-100 flex flex-col gap-1 text-[11px]">
                          <div className="flex justify-between font-black">
                            <span>العرض التلقائي للخدمة الذاتية:</span>
                            <span className="font-mono">-{customerTotals.autoDiscountPercent}%</span>
                          </div>
                          <span className="text-[10px] font-black leading-relaxed">{customerTotals.autoDiscountName}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-sm font-black text-slate-850 pt-3 border-t-2 border-dashed border-slate-200">
                        <span>قيمة الدفع الإجمالية:</span>
                        <span className="text-lg font-mono text-pink-600">{customerTotals.finalTotal.toFixed(2)} ريال</span>
                      </div>
                    </div>

                    {/* Submit order button */}
                    <button
                      type="button"
                      disabled={customerCart.length === 0}
                      onClick={handleSubmitCustomerOrder}
                      className={`w-full font-black py-4 rounded-2xl border-b-4 transition flex items-center justify-center gap-2 cursor-pointer shadow-lg text-xs leading-none uppercase ${
                        customerCart.length === 0
                          ? 'bg-slate-200 text-slate-450 border-slate-350 cursor-not-allowed'
                          : 'bg-pink-500 hover:bg-pink-600 text-white border-pink-700 hover:border-pink-800 active:scale-[0.99] duration-100'
                      }`}
                      style={{ backgroundColor: customerCart.length === 0 ? '#cbd5e1' : '#ec4899', borderColor: customerCart.length === 0 ? '#94a3b8' : '#be185d' }}
                    >
                      <span>🚀</span>
                      <span>إرسال وتحضير الطلب سحابياً</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setIsCartOpen(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full py-2.5 bg-slate-50 hover:bg-slate-150 border-2 border-slate-200 text-slate-650 hover:text-slate-800 transition rounded-xl text-[11px] font-black text-center block cursor-pointer"
                    >
                      العودة لتعديل وتصميم الأكواب 🍧
                    </button>
                  </div>

                </div>

              </div>

            </div>
          ) : (
            /* --- CLIENT ICE CREAM CUSTOMIZATION BUILDER INTERFACE --- */
            <div className="max-w-3xl mx-auto space-y-6">
              
              {/* STEP 1: CHOOSE CUP OR CONE */}
              <div className="bg-white rounded-3xl p-6 border-4 border-slate-800 shadow-[8px_8px_0px_rgba(30,41,59,0.1)] space-y-4">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 border-r-4 border-pink-500 pr-3">
                  <span>1. نوع وعاء التقديم والتركيب</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {containers.map(opt => {
                    const isSelected = custContainer?.id === opt.id;
                    const isAvailable = opt.isAvailable !== false;
                    return (
                      <button
                        key={opt.id}
                        disabled={!isAvailable}
                        onClick={() => setCustContainer(opt)}
                        className={`text-center p-6 rounded-3xl border-4 transition-all relative overflow-hidden flex flex-col items-center justify-center gap-2.5 ${
                          !isAvailable
                            ? 'bg-slate-50 border-slate-200 opacity-40 cursor-not-allowed'
                            : isSelected
                              ? 'bg-pink-50/20 border-pink-500 shadow-[8px_8px_0px_0px_rgba(236,72,153,0.1)] cursor-pointer'
                              : 'bg-white border-slate-200 opacity-80 hover:opacity-100 cursor-pointer'
                        }`}
                      >
                        <span className="text-5xl">{opt.id === 'cone' ? '🍦' : '🍨'}</span>
                        <div>
                          <span className="text-base font-black text-slate-800 block">{opt.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold block mt-1 leading-relaxed">{opt.description}</span>
                        </div>
                        {!isAvailable ? (
                          <span className="px-4 py-1.5 rounded-full font-black text-xs border-2 bg-slate-100 border-slate-200 text-slate-500 shadow-sm">
                            غير متوفر حالياً ❌
                          </span>
                        ) : (
                          <span className={`px-4 py-1.5 rounded-full font-black text-xs border-2 ${
                            isSelected ? 'bg-pink-505 border-pink-600 text-white shadow-sm' : 'bg-pink-50 border-pink-100 text-pink-600'
                          }`} style={{ borderColor: isSelected ? '#ec4899' : '#fbcfe8', backgroundColor: isSelected ? '#ec4899' : '#fdf2f8' }}>
                            {opt.price.toFixed(2)} ر.س
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STEP 2: SCOOPS FLAVORS (1-3 SCOOPS) */}
              <div className="bg-white rounded-3xl p-6 border-4 border-slate-800 shadow-[8px_8px_0px_rgba(30,41,59,0.1)] space-y-4">
                <div className="flex justify-between items-center border-r-4 border-pink-500 pr-3 gap-2">
                  <h2 className="text-lg font-black text-slate-805">
                    <span>2. كرات نكهات الآيس كريم</span>
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {flavors.map(opt => {
                    const countSelected = custFlavors.filter(f => f.id === opt.id).length;
                    const isAvailable = opt.isAvailable !== false;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => {
                          const currentTotalCount = custFlavors.length;
                          if (countSelected > 0) {
                            const indexIdx = custFlavors.findIndex(f => f.id === opt.id);
                            setCustFlavors(prev => prev.filter((_, i) => i !== indexIdx));
                          } else {
                            if (currentTotalCount >= 3) {
                              triggerNotice('الحد الأقصى المسموح به هو ٣ كرات آيس كريم للقرص الواحد!', 'error');
                              return;
                            }
                            setCustFlavors(prev => [...prev, opt]);
                          }
                        }}
                        className={`p-4 rounded-2xl border-2 transition flex flex-col items-center justify-center gap-2 relative ${
                          !isAvailable
                            ? 'bg-slate-55 border-slate-150 opacity-40 cursor-not-allowed text-slate-400'
                            : countSelected > 0
                              ? 'bg-pink-500 text-white border-pink-600 shadow-md scale-[1.02] cursor-pointer'
                              : 'bg-slate-50 border-slate-200 hover:border-pink-300 hover:bg-slate-100/50 text-slate-700 cursor-pointer'
                        }`}
                      >
                        <span className="text-3xl">{opt.emoji}</span>
                        <div className="text-center font-sans text-xs">
                          <span className="font-black block truncate">{opt.name}</span>
                          {!isAvailable ? (
                            <span className="text-[9px] font-black block mt-0.5 text-rose-500">غير متوفر ❌</span>
                          ) : opt.price > 0 ? (
                            <span className="text-[9px] font-bold block mt-0.5 opacity-80 font-mono">+{opt.price.toFixed(2)} ر.س</span>
                          ) : null}
                        </div>
                        {countSelected > 0 && (
                          <span className="bg-white text-pink-600 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black shadow-sm">
                            {countSelected}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STEP 3: SELECT EXTENDED TOPPINGS */}
              <div className="bg-white rounded-3xl p-6 border-4 border-slate-800 shadow-[8px_8px_0px_rgba(30,41,59,0.1)] space-y-4">
                <h2 className="text-lg font-black text-slate-800 flex items-center justify-between border-r-4 border-pink-500 pr-3">
                  <span>3. إضافة حب الرغبة والزينة الحصرية وافل وصوص</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {toppings.map(opt => {
                    const isSelected = custToppings.some(t => t.id === opt.id);
                    const isAvailable = opt.isAvailable !== false;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => {
                          if (isSelected) {
                            setCustToppings(prev => prev.filter(t => t.id !== opt.id));
                          } else {
                            setCustToppings(prev => [...prev, opt]);
                          }
                        }}
                        className={`p-3.5 rounded-2xl border-2 transition flex items-center gap-3 text-right w-full relative ${
                          !isAvailable
                            ? 'bg-slate-55 border-slate-150 opacity-40 cursor-not-allowed text-slate-400'
                            : isSelected
                              ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-[1.01] cursor-pointer'
                              : 'bg-slate-50 border-slate-200 hover:border-emerald-300 hover:bg-slate-100/50 text-slate-700 cursor-pointer'
                        }`}
                      >
                        <span className="text-2xl shrink-0">{opt.emoji}</span>
                        <div className="min-w-0 flex-1 font-sans text-xs">
                          <span className="font-black block truncate">{opt.name}</span>
                          {!isAvailable ? (
                            <span className="text-[9px] font-black block mt-0.5 text-rose-500">غير متوفر ❌</span>
                          ) : (
                            <span className="text-[9px] font-bold block opacity-80 font-mono">{opt.price === 0 ? 'مجاناً ✨' : `+${opt.price.toFixed(2)} ر.س`}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CONFIGURED CUSTOMIZER ACTIONS PANEL */}
              <div className="bg-gradient-to-r from-pink-50 to-amber-50/60 rounded-3xl p-5 border-2 border-pink-100/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800">هل أكملت تصميم كوب آيس كريم أحلامك الفاخر؟</h3>
                  <p className="text-[11px] text-slate-500 font-bold mt-1 max-w-md">أضف هذا المزيج الرائع لسلتك لتستطيع تعبئة طلبك وإرساله فوراً للمطبخ!</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto font-sans text-xs">
                  {/* Quantity counter */}
                  <div className="flex items-center bg-white rounded-xl overflow-hidden border border-slate-200 h-10 shrink-0 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setCustQuantity(q => Math.max(1, q - 1))}
                      className="px-2.5 hover:bg-slate-50 text-slate-600 font-black h-full transition w-8 text-center cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-1 font-mono font-black text-xs text-pink-600">{custQuantity} أكواب</span>
                    <button
                      type="button"
                      onClick={() => setCustQuantity(q => q + 1)}
                      className="px-2.5 hover:bg-slate-50 text-slate-600 font-black h-full transition w-8 text-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={handleAddCustItemToCart}
                    className="flex-1 md:flex-initial bg-pink-500 hover:bg-pink-600 active:scale-95 text-white font-black text-xs h-10 px-5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_2px_8px_rgba(236,72,153,0.15)] hover:shadow-[0_4px_12px_rgba(236,72,153,0.3)] duration-200"
                  >
                    <span>➕</span>
                    <span>إضافة هذا الآيس كريم للسلة</span>
                  </button>
                </div>
              </div>

            </div>
          )}
        </main>

        {/* --- CUSTOMER BRAND FOOTER --- */}
        <footer className="mt-16 text-center text-xs text-slate-400 select-none pb-8 space-y-2">
          <p className="font-extrabold text-pink-400 tracking-wide font-sans">ادفع لاحقاً نقداً أو شبكة يدوياً عند استلام الكوب اللذيذ من لوحة الكاشير 🍦</p>
          <p className="mt-1.5 opacity-75 font-bold">كل آيس كريم يصنع بشغف لابتسامتكم • سحر الآيس كريم</p>
          <div className="pt-2 opacity-50 hover:opacity-100 transition">
            <a 
              href="#/seller" 
              className="text-[10px] bg-slate-100/80 text-slate-500 hover:text-slate-850 rounded-lg px-2.5 py-1.5 hover:bg-slate-200"
            >
              الولوج لكاشير المبيعات / الإدارة ⚙️
            </a>
          </div>
        </footer>

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50/40 text-slate-800 font-sans antialiased pb-12 selection:bg-pink-100 border-8 border-white" dir="rtl">
      
      {/* Decorative Ice Cream Border Accent */}
      <div className="h-2 bg-gradient-to-r from-pink-500 via-amber-400 to-emerald-400" />

      {/* --- NOTIFICATION TOAST --- */}
      <AnimatePresence>
        {alertMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-11/12 p-4 rounded-2xl shadow-xl border-4 flex items-center justify-between text-right"
            style={{
              backgroundColor: alertMessage.type === 'success' ? '#F0FDF4' : alertMessage.type === 'error' ? '#FEF2F2' : '#F0F9FF',
              borderColor: alertMessage.type === 'success' ? '#16A34A' : alertMessage.type === 'error' ? '#DC2626' : '#2563EB',
              color: alertMessage.type === 'success' ? '#166534' : alertMessage.type === 'error' ? '#991B1B' : '#075985',
              boxShadow: '6px 6px 0px 0px rgba(30,41,59,0.1)'
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {alertMessage.type === 'success' ? '✨' : alertMessage.type === 'error' ? '⚠️' : 'ℹ️'}
              </span>
              <p className="font-black text-sm leading-relaxed">{alertMessage.text}</p>
            </div>
            <button 
              onClick={() => setAlertMessage(null)} 
              className="text-xs font-black px-2 py-1 hover:bg-black/5 rounded-lg mr-4 transition"
            >
              إغلاق
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- APP HEADER --- */}
      <header className="max-w-7xl mx-auto px-4 pt-6 pb-4">
        <div className="bg-white rounded-3xl p-6 border-b-4 border-pink-200 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-[8px_8px_0px_0px_rgba(236,72,153,0.06)]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-pink-500 rounded-2xl flex items-center justify-center text-4xl font-black shadow-md shrink-0 select-none">
              🍦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black text-pink-600 tracking-tight leading-none uppercase">سحر الآيس كريم</h1>
                <span className="bg-pink-100 text-pink-600 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-pink-200 select-none">الذكي والسلس</span>
              </div>
              <p className="text-pink-400 font-bold text-xs mt-1.5 tracking-wider">نظام مبيعات وحساب أكواب وبسكوتات الآيسكريم الفورية</p>
            </div>
          </div>

          {/* Real-time total indicators & Quick Menu Tabs */}
          <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
            <div className="text-left bg-pink-50/70 py-2 px-5 rounded-2xl border-2 border-pink-150 flex flex-col items-end shrink-0 w-full sm:w-auto font-sans">
              <div className="text-3xl font-black text-slate-800 font-mono leading-none">
                {activeTab === 'POS' 
                  ? cartTotals.finalTotal.toFixed(2) 
                  : activeTab === 'OnlineOrders'
                    ? onlineOrders.length
                    : activeTab === 'OnlineSetup'
                      ? 'نشط'
                      : activeTab === 'History' 
                        ? salesStats.totalRevenue.toFixed(2) 
                        : (containers.length + flavors.length + toppings.length).toFixed(0)}
                <span className="text-xs font-bold mr-1 text-pink-600">
                  {activeTab === 'OnlineOrders' ? 'طلب' : activeTab === 'OnlineSetup' ? 'بث' : activeTab === 'Prices' ? 'مادة' : 'ريال'}
                </span>
              </div>
              <div className="text-slate-400 font-black uppercase text-[9px] tracking-wider mt-1 font-sans">
                {activeTab === 'POS' 
                  ? 'الحساب المستحق الحالي' 
                  : activeTab === 'OnlineOrders'
                    ? 'طلبات الخدمة الذاتية النشطة'
                    : activeTab === 'OnlineSetup'
                      ? 'إعداد الرابط والباركود للجمهور'
                      : activeTab === 'History' 
                        ? 'إجمالي الدخل اليومي الصافي' 
                        : 'قائمة الأسعار والمنتجات الفعالة'}
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto shrink-0 font-sans flex-wrap sm:flex-nowrap">
              {/* 1. طلبات الأونلاين (First) */}
              <button
                onClick={() => setActiveTab('OnlineOrders')}
                className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg font-black text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
                  activeTab === 'OnlineOrders'
                    ? 'bg-emerald-500 text-white shadow-[2px_2px_0px_0px_rgba(30,41,59,0.1)] border border-emerald-600'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${pendingCount > 0 ? 'animate-bounce text-yellow-300' : ''}`} />
                <span>طلبات الأونلاين</span>
                {pendingCount > 0 ? (
                  <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-md flex items-center justify-center font-black animate-pulse">
                    {pendingCount} جديد
                  </span>
                ) : onlineOrders.length > 0 ? (
                  <span className="bg-slate-200 text-slate-700 text-[9px] px-1 py-0.5 rounded-md font-black">
                    {onlineOrders.length}
                  </span>
                ) : null}
              </button>

              {/* 2. المبيعات (Second) */}
              <button
                onClick={() => setActiveTab('History')}
                className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg font-black text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'History'
                    ? 'bg-slate-800 text-white shadow-[2px_2px_0px_0px_rgba(30,41,59,0.1)] border border-slate-900'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>المبيعات</span>
                {salesHistory.length > 0 && (
                  <span className="bg-slate-700 text-white text-[9px] px-1 py-0.5 rounded-md font-black font-sans">
                    {salesHistory.length}
                  </span>
                )}
              </button>

              {/* 4. الاعدادات (Fourth) */}
              <button
                onClick={() => setActiveTab('Prices')}
                className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg font-black text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'Prices'
                    ? 'bg-amber-500 text-white shadow-[2px_2px_0px_0px_rgba(30,41,59,0.1)] border border-amber-600'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>الاعدادات</span>
              </button>

              {/* 5. إعداد الطلب الذاتي / الباركود (Last) */}
              <button
                onClick={() => setActiveTab('OnlineSetup')}
                className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg font-black text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
                  activeTab === 'OnlineSetup'
                    ? 'bg-teal-600 text-white shadow-[2px_2px_0px_0px_rgba(30,41,59,0.1)] border border-teal-700'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                }`}
              >
                <Link className="w-3.5 h-3.5" />
                <span>إعداد الطلب الذاتي 🌐</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* --- TAB 1: POINT OF SALE SYSTEM --- */}
      <main className="max-w-7xl mx-auto px-4 mt-2">
        {activeTab === 'POS' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* BUILDER SIDE (Right Column in RTL, col-span-7) */}
            <section className="lg:col-span-7 space-y-6">

              {/* CLIENT-LINK QUICK ACCESSIBILITY BANNER */}
              <div className="bg-gradient-to-r from-pink-50 to-pink-100/50 p-4.5 rounded-3xl border-2 border-pink-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl animate-pulse">🔗</span>
                  <div className="text-right">
                    <span className="font-extrabold text-pink-700 block">رابط الخدمة الذاتية للعملاء</span>
                    <span className="text-[10px] text-pink-500 font-bold block mt-0.5">افتحه في شاشة منفصلة للعملاء للطلب المباشر!</span>
                  </div>
                </div>
                <a 
                  href="#/" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="bg-pink-500 hover:bg-pink-600 text-white font-black px-4.5 py-2.5 rounded-xl transition shadow-md hover:scale-[1.02] flex items-center gap-1 shrink-0 text-center text-[10px] border-b-2 border-pink-700"
                >
                  افتح صفحة العميل ↗
                </a>
              </div>

              {/* STAGE 2: Choose Container (1. اختيار نوع الوعاء) */}
              <div className="bg-white rounded-3xl p-6 border-4 border-slate-850 shadow-[8px_8px_0px_rgba(30,41,59,0.1)]">
                <h2 className="text-xl font-black text-slate-800 mb-6 border-r-4 border-pink-500 pr-3">
                  1. اختيار نوع الوعاء والتقديم
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {containers.map(opt => {
                    const isSelected = selectedContainer.id === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedContainer(opt)}
                        className={`text-center p-6 rounded-3xl border-4 transition-all relative overflow-hidden group flex flex-col items-center justify-center gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-pink-50/20 border-pink-500 shadow-[8px_8px_0px_0px_rgba(236,72,153,0.1)]'
                            : 'bg-white border-slate-200 opacity-70 hover:opacity-100 hover:border-pink-300'
                        }`}
                        id={`container-opt-${opt.id}`}
                      >
                        <span className="text-6xl">{opt.id === 'cone' ? '🍦' : '🍨'}</span>
                        <div className="text-center">
                          <span className="text-xl font-black text-slate-800 block">{opt.name}</span>
                          <span className="text-[11px] text-slate-400 font-bold block mt-1 leading-relaxed">{opt.description}</span>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full font-black text-sm border-2 ${
                          isSelected ? 'bg-pink-500 border-pink-600 text-white shadow-sm' : 'bg-pink-50 border-pink-100 text-pink-600'
                        }`}>
                          {opt.price.toFixed(2)} ريال
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STAGE 3: Choose Flavors (2. نكهات كرات الآيس كريم) */}
              <div className="bg-white rounded-3xl p-6 border-2 border-slate-205 shadow-[4px_4px_0px_0px_rgba(236,72,153,0.06)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                  <h2 className="text-xl font-black text-slate-800 border-r-4 border-pink-500 pr-3">
                    2. نكهات كرات الآيس كريم
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {flavors.map(flavor => {
                    const selectedCount = selectedFlavors.filter(f => f.id === flavor.id).length;
                    const isSelected = selectedCount > 0;
                    return (
                      <button
                        key={flavor.id}
                        onClick={() => handleFlavorToggle(flavor)}
                        className={`text-right p-4 rounded-2xl border-2 flex justify-between items-center transition relative cursor-pointer ${
                          isSelected
                            ? 'bg-pink-500 border-pink-600 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]'
                            : 'bg-white border-slate-200 hover:border-pink-300 text-slate-700'
                        }`}
                        id={`flavor-opt-${flavor.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl shrink-0">{flavor.emoji}</span>
                          <div className="min-w-0">
                            <p className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>{flavor.name}</p>
                            <p className={`text-[9px] font-bold font-mono mt-0.5 ${isSelected ? 'text-pink-150' : 'text-slate-400'}`}>{flavor.nameEn}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {flavor.price > 0 && (
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-pink-650 text-white' : 'bg-pink-50 text-pink-700 border border-pink-100'
                            }`}>
                              +{flavor.price} ر.س
                            </span>
                          )}
                          {isSelected && (
                            <span className="bg-white text-pink-600 rounded-full w-5 h-5 flex items-center justify-center font-black text-xs shadow-inner">
                              {selectedCount}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STAGE 4: Toppings (3. إضافات ومكملات التزيين) */}
              <div className="bg-white rounded-3xl p-6 border-4 border-slate-850 shadow-[8px_8px_0px_rgba(30,41,59,0.1)]">
                <div className="flex items-center justify-between mb-6 pb-2 border-b border-dashed border-slate-200 font-sans">
                  <h2 className="text-xl font-black text-slate-800 border-r-4 border-pink-500 pr-3">
                    الاضافات
                  </h2>
                </div>

                <div className="space-y-6">
                  {/* Category: Solids */}
                  {toppings.filter(t => t.category === 'solid').length > 0 && (
                    <div>
                      <h3 className="text-xs font-black text-slate-400 mb-3 block uppercase tracking-widest mr-1">المقرمشات والمكسرات الصلبة</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                        {toppings.filter(t => t.category === 'solid').map(topping => {
                          const isSelected = selectedToppings.some(t => t.id === topping.id);
                          return (
                            <button
                              key={topping.id}
                              onClick={() => handleToppingToggle(topping)}
                              className={`p-3 rounded-2xl border-2 flex justify-between items-center transition cursor-pointer text-right ${
                                isSelected
                                  ? 'bg-pink-500 border-pink-650 text-white shadow-md font-bold'
                                  : 'bg-white border-slate-200 hover:border-pink-300 text-slate-700'
                              }`}
                              id={`topping-opt-${topping.id}`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-lg shrink-0">{topping.emoji}</span>
                                <span className="text-[11px] font-bold truncate">{topping.name}</span>
                              </div>
                              <span className={`text-[10px] font-black shrink-0 ${
                                isSelected ? 'text-white' : 'text-pink-600'
                              }`}>
                                +{topping.price.toFixed(2)} ر.س
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Category: Sauces */}
                  {toppings.filter(t => t.category === 'sauce').length > 0 && (
                    <div>
                      <h3 className="text-xs font-black text-slate-400 mb-3 block uppercase tracking-widest mr-1">الصوصات والسوائل الهلامية</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                        {toppings.filter(t => t.category === 'sauce').map(topping => {
                          const isSelected = selectedToppings.some(t => t.id === topping.id);
                          return (
                            <button
                              key={topping.id}
                              onClick={() => handleToppingToggle(topping)}
                              className={`p-3 rounded-2xl border-2 flex justify-between items-center transition cursor-pointer text-right ${
                                isSelected
                                  ? 'bg-pink-500 border-pink-650 text-white shadow-md font-bold'
                                  : 'bg-white border-slate-200 hover:border-pink-300 text-slate-700'
                              }`}
                              id={`topping-opt-${topping.id}`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-lg shrink-0">{topping.emoji}</span>
                                <span className="text-[11px] font-bold truncate">{topping.name}</span>
                              </div>
                              <span className={`text-[10px] font-black shrink-0 ${
                                isSelected ? 'text-white' : 'text-pink-600'
                              }`}>
                                +{topping.price.toFixed(2)} ر.س
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Category: Fruits */}
                  {toppings.filter(t => t.category === 'fruit').length > 0 && (
                    <div>
                      <h3 className="text-xs font-black text-slate-400 mb-3 block uppercase tracking-widest mr-1">قطع الفواكه الطازجة</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                        {toppings.filter(t => t.category === 'fruit').map(topping => {
                          const isSelected = selectedToppings.some(t => t.id === topping.id);
                          return (
                            <button
                              key={topping.id}
                              onClick={() => handleToppingToggle(topping)}
                              className={`p-3 rounded-2xl border-2 flex justify-between items-center transition cursor-pointer text-right ${
                                isSelected
                                  ? 'bg-pink-500 border-pink-650 text-white shadow-md font-bold'
                                  : 'bg-white border-slate-200 hover:border-pink-300 text-slate-700'
                              }`}
                              id={`topping-opt-${topping.id}`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-lg shrink-0">{topping.emoji}</span>
                                <span className="text-[11px] font-bold truncate">{topping.name}</span>
                              </div>
                              <span className={`text-[10px] font-black shrink-0 ${
                                isSelected ? 'text-white' : 'text-pink-600'
                              }`}>
                                +{topping.price.toFixed(2)} ر.س
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </section>

            {/* CART & CHECKOUT INVOICER (Left Column, col-span-5) */}
            <section className="lg:col-span-5 space-y-6">

              {/* LIVE COMPOSITION BUILDER (تصميم ومعاينة الآيس كريم الحالي) */}
              <div className="bg-white rounded-3xl p-5 border-4 border-slate-800 shadow-[8px_8px_0px_0px_rgba(30,41,59,0.1)] overflow-hidden relative">
                <div className="absolute top-0 right-0 bg-pink-500 text-white text-[10px] font-black px-4.5 py-1 rounded-bl-xl border-l-2 border-b-2 border-slate-800 select-none">
                  تصميم مباشر
                </div>

                <h2 className="text-base font-black text-slate-800 mb-4 border-r-4 border-pink-500 pr-2 flex items-center gap-1.5 select-none">
                  <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                  <span>تجهيز الآيس كريم الحالي</span>
                </h2>

                <div className="flex flex-col gap-4">
                  {/* Interactive Scoop Stack Rendering inside left column - compact height to avoid taking too much vertical space */}
                  <div className="bg-gradient-to-b from-rose-50/50 via-pink-50/20 to-slate-50 rounded-2xl p-4 h-48 flex flex-col items-center justify-center border-2 border-slate-200 shadow-inner relative group select-none">
                    {/* Background sparkles */}
                    <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden">
                      <span className="absolute top-2 left-6 text-xl animate-bounce">✨</span>
                      <span className="absolute bottom-6 right-6 text-xl animate-pulse">🌟</span>
                      <span className="absolute top-1/2 left-3 text-xs font-sans">🍒</span>
                    </div>

                    {/* The Interactive Scoop Stack Rendering */}
                    <div className="relative flex flex-col items-center justify-end h-36 w-full mt-auto select-none">
                      {/* Scoop topper icon */}
                      {selectedToppings.length > 0 && (
                        <motion.div 
                          initial={{ y: -15, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className="absolute -top-3 z-40 text-2.5xl drop-shadow"
                          title="إضافات علوية"
                        >
                          🍒
                        </motion.div>
                      )}

                      {/* Stack of Scoops */}
                      <div className="flex flex-col-reverse items-center justify-end -mb-2 z-20 font-sans">
                        {selectedFlavors.map((flavor, index) => {
                          return (
                            <motion.div
                              key={`${flavor.id}-${index}`}
                              initial={{ scale: 0, y: -30 }}
                              animate={{ scale: 1, y: 0 }}
                              transition={{ type: 'spring', stiffness: 200, delay: index * 0.08 }}
                              className="w-16 h-13 rounded-full -mt-6 shadow-md border-2 relative flex items-center justify-center overflow-hidden animate-none"
                              style={{ 
                                backgroundColor: flavor.color,
                                borderColor: 'rgba(0,0,0,0.12)',
                                color: ['#FFFDF0', '#B5E2A8', '#A0B2F0'].includes(flavor.color) ? '#334155' : '#FFFFFF',
                                zIndex: 10 + index
                              }}
                            >
                              <div className="absolute inset-x-0 bottom-1 h-2 bg-black/10 rounded-full blur-[1px]" />
                              <span className="text-lg drop-shadow-sm">{flavor.emoji}</span>

                              {/* Topping Sprinkles */}
                              {selectedToppings.some(t => t.id === 'sprinkles') && (
                                <div className="absolute inset-0 pointer-events-none grid grid-cols-4 gap-0.5 p-1.5 opacity-80 rotate-12">
                                  <div className="w-1.5 h-2 bg-red-400 rounded-full" />
                                  <div className="w-1.5 h-2 bg-yellow-400 rounded-full" />
                                  <div className="w-1.5 h-2 bg-blue-400 rounded-full" />
                                  <div className="w-1.5 h-2 bg-green-400 rounded-full" />
                                </div>
                              )}

                              {/* Topping Sauces */}
                              {selectedToppings.some(t => t.id === 'choco_sauce') && (
                                <div className="absolute inset-x-0 top-0 h-3 bg-[#3E2723]/80 rounded-t-full" />
                              )}
                              {selectedToppings.some(t => t.id === 'caramel_sauce') && (
                                <div className="absolute inset-x-0 top-0 h-3 bg-[#D84315]/70 rounded-t-full" />
                              )}
                              {selectedToppings.some(t => t.id === 'strawberry_sauce') && (
                                <div className="absolute inset-x-0 top-0 h-3 bg-[#E91E63]/70 rounded-t-full" />
                              )}
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* Container Base Graphic */}
                      {selectedContainer.id === 'cone' ? (
                        <motion.div 
                          layoutId="containerBaseSmall"
                          className="w-12 h-18 bg-gradient-to-b from-[#D2B48C] to-[#8B5A2B] relative z-10 clip-triangle shadow-sm flex items-center justify-center border-t-2 border-amber-300"
                          style={{
                            clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
                            marginTop: '-4px'
                          }}
                        >
                          <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(0,0,0,0.05)_25%,transparent_25%),linear-gradient(-45deg,rgba(0,0,0,0.05)_25%,transparent_25%)] bg-[size:8px_8px]" />
                        </motion.div>
                      ) : (
                        <motion.div 
                          layoutId="containerBaseSmall"
                          className="w-18 h-12 bg-white border-2 border-red-200 rounded-b-2xl rounded-t-md shadow-md z-10 relative mt-[-4px] overflow-hidden flex flex-col justify-between items-center py-1"
                        >
                          <div className="w-full h-1.5 bg-gradient-to-r from-red-400 via-rose-300 to-red-400 absolute top-0" />
                          <div className="text-[8px] text-red-400 font-black z-10 mt-0.5 uppercase tracking-widest font-mono">SWEET ICE</div>
                        </motion.div>
                      )}
                    </div>

                    <div className="mt-2 text-center">
                      <p className="text-xs font-black text-slate-700">
                        {selectedContainer.name} • {selectedFlavors.length} نكهات
                      </p>
                    </div>
                  </div>

                  {/* Pricing Breakdown and Quick Addition */}
                  <div className="space-y-3 font-sans">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1 text-[11px] text-slate-600">
                      <div className="flex justify-between items-center">
                        <span className="font-bold">الوعاء ({selectedContainer.name}):</span>
                        <span className="font-black text-slate-800">{selectedContainer.price.toFixed(2)} ر.س</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">نكهة الآيسكريم ({selectedFlavors.map(f => f.name).join(' + ')} • {selectedFlavors.length} كرات):</span>
                        <span className="font-black text-pink-600">+{currentItemPrices.flavorsPrice.toFixed(2)} ر.س</span>
                      </div>
                      {selectedToppings.length > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="font-bold">الإضافات ({selectedToppings.map(t => t.name).join(' + ')}):</span>
                          <span className="font-black text-emerald-600">+{currentItemPrices.toppingsPrice.toFixed(2)} ر.س</span>
                        </div>
                      )}
                      <hr className="my-1 border-dashed border-slate-200" />
                      <div className="flex justify-between items-center text-xs font-black">
                        <span className="text-slate-800">سعر الحبة الكلي:</span>
                        <span className="text-pink-600 font-mono">{currentItemPrices.totalUnit.toFixed(2)} ر.س</span>
                      </div>
                    </div>

                    {/* Quantity & Action */}
                    <div className="flex items-center gap-2">
                      <div className="bg-slate-100 rounded-xl p-0.5 flex items-center border-2 border-slate-300 select-none">
                        <button
                          onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                          className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-black text-slate-700 hover:bg-slate-50 transition active:scale-95 cursor-pointer"
                          title="تقليل الكمية"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-black text-xs text-slate-800 font-mono">
                          {quantity}
                        </span>
                        <button
                          onClick={() => setQuantity(prev => prev + 1)}
                          className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-black text-slate-700 hover:bg-slate-50 transition active:scale-95 cursor-pointer"
                          title="زيادة الكمية"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={handleAddToCart}
                        disabled={selectedFlavors.length === 0}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 border-b-4 ${
                          selectedFlavors.length > 0
                            ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white border-pink-700 shadow-sm'
                            : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        }`}
                        id="btn-add-to-cart"
                      >
                        <span>🛒</span>
                        <span>إضافة للفاتورة</span>
                        <span className="bg-white/20 px-1.5 py-0.2 rounded-md text-[10px] font-mono">
                          {(currentItemPrices.totalUnit * quantity).toFixed(2)} ر.س
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* CART ITEMS CONTAINER (قائمة الطلبات المضافة) */}
              <div className="bg-white rounded-3xl p-6 border-4 border-slate-800 shadow-[8px_8px_0px_0px_rgba(30,41,59,0.1)] flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between pb-4 border-b-4 border-slate-100">
                  <h2 className="font-extrabold text-lg text-slate-800 flex items-center gap-2.5 font-sans">
                    <span className="bg-pink-100 p-1.5 rounded-xl flex items-center justify-center border border-pink-200 shadow-sm">
                      <CartIcon className="w-5 h-5 text-pink-500" />
                    </span>
                    <span className="tracking-tight text-slate-850 hover:text-pink-600 transition duration-200 font-sans font-black">سلة الطلبات والفاتورة</span>
                  </h2>
                  <span className="text-xs font-mono font-black bg-pink-100 text-pink-600 border border-pink-200 px-3 py-1.5 rounded-full" id="cart-count">
                    {cartTotals.totalItemsCount} أصناف
                  </span>
                </div>

                <div className="p-5 space-y-6">

                  {/* 2. ADDED SALES ITEMS (قائمة المبيعات والمنتجات المضافة) */}
                  <div className="pt-2">
                    <h3 className="text-xs font-black text-slate-450 mb-3 block uppercase tracking-widest mr-1">المواد والمبيعات المضافة حالياً للفاتورة</h3>
                    
                    <div className="flex-1 min-h-[140px] max-h-[300px] overflow-y-auto">
                      {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center select-none bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-4">
                          <span className="text-4xl mb-2 animate-bounce">🛒</span>
                          <p className="text-xs font-black text-slate-700">سلة المبيعات فارغة</p>
                          <p className="text-[10px] text-slate-400 mt-1 max-w-[210px] leading-relaxed font-bold">
                            اختر الوعاء ثم النكهات والصلصات باليمين، واضغط زر <strong>"إضافة للفاتورة"</strong> لإنشاء صنف جديد فوراً!
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 pr-1">
                          {cart.map((item) => (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-200 flex items-start gap-3 relative group"
                            >
                              <div className="w-10 h-10 rounded-xl bg-pink-500 text-white flex flex-col items-center justify-center text-xl shadow shrink-0">
                                {item.container.id === 'cone' ? '🍦' : '🍨'}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-black text-slate-900 truncate">
                                    {item.container.name} <span className="text-pink-500 font-bold font-mono">({item.quantity}x)</span>
                                  </h4>
                                  <span className="text-xs font-black text-slate-900 font-mono">
                                    {item.itemTotal.toFixed(2)} ر.س
                                  </span>
                                </div>

                                {/* Flavors representation */}
                                <div className="flex flex-wrap gap-1 mt-1 font-sans">
                                  {item.flavors.map((fl, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[9px] px-2 py-0.5 rounded-full font-black border"
                                      style={{ backgroundColor: `${fl.color}25`, borderColor: `${fl.color}80`, color: '#111827' }}
                                    >
                                      {fl.emoji} {fl.name}
                                    </span>
                                  ))}
                                </div>

                                {/* Toppings representation */}
                                {item.toppings.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-dashed border-slate-200">
                                    {item.toppings.map((tp, idx) => (
                                      <span key={idx} className="text-[9px] bg-emerald-50 text-emerald-850 border border-emerald-100 px-1.5 py-0.5 rounded-md font-bold">
                                        {tp.emoji} {tp.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Quick delete item */}
                              <button
                                onClick={() => handleRemoveFromCart(item.id)}
                                className="bg-red-50 text-red-650 hover:bg-red-150 p-2 rounded-xl transition opacity-100 group-hover:opacity-100 focus:opacity-100 absolute -top-2 -left-2 border-2 border-red-200 cursor-pointer shadow-sm"
                                id={`btn-delete-${item.id}`}
                                title="حذف هذا الصنف من السلة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {cart.length > 0 && (
                    <div className="space-y-4 pt-4 border-t-2 border-slate-100">
                      
                      {/* CART RESET / CLEAR BUTTON */}
                      <button
                        onClick={handleClearCart}
                        className="text-xs font-black text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 py-3 px-4 rounded-2xl transition flex items-center justify-center gap-1.5 border-2 border-dashed border-red-200 w-full cursor-pointer font-sans"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>تصفير وإلغاء السلة بالكامل</span>
                      </button>



                      {/* COOP MANUAL EXTRA DISCOUNT ROW */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-1 leading-relaxed">
                          الخصومات الإضافية (خصم يدوي):
                        </label>
                        <div className="flex items-center gap-2 font-sans">
                          <button
                            type="button"
                            onClick={() => setManualDiscountVal(v => Math.max(0, v - 1))}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-95 cursor-pointer border border-slate-200"
                            title="ناقص 1 ريال"
                          >
                            -
                          </button>
                          <div className="flex items-center bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-inner flex-1">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              placeholder="0.00"
                              value={manualDiscountVal === 0 ? '' : manualDiscountVal}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setManualDiscountVal(isNaN(val) ? 0 : Math.max(0, val));
                              }}
                              className="w-full text-center text-xs font-black font-mono text-slate-800 focus:outline-none py-1.5"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setManualDiscountVal(v => v + 1)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-95 cursor-pointer border border-slate-200"
                            title="زائد 1 ريال"
                          >
                            +
                          </button>
                          <span className="text-xs font-bold text-slate-400">ر.س</span>
                        </div>
                      </div>

                      {/* PRICES BREAKDOWN AND BILL */}
                      <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-200 space-y-2 text-xs font-sans">
                        <div className="flex justify-between text-slate-600">
                          <span className="font-bold">إجمالي أساسي المنتجات:</span>
                          <span className="font-mono font-black">{(cartTotals.productsSubtotal).toFixed(2)} ر.س</span>
                        </div>

                        {/* Customer Name Input Row */}
                        <div className="pt-2 pb-1 border-t border-dashed border-slate-200">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black text-slate-500" htmlFor="input-customer-name">
                              اسم العميل لتوثيقه بالفاتورة:
                            </label>
                            <input
                              type="text"
                              id="input-customer-name"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              placeholder="أدخل اسم العميل هنا (اختياري)..."
                              className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-bold focus:ring-1 focus:ring-pink-400 focus:border-pink-400 focus:outline-none transition placeholder:text-slate-300"
                            />
                          </div>
                        </div>
                        {cartTotals.toppingsSubtotal > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span className="font-bold">إجمالي تكاليف الإضافات الممتازة:</span>
                            <span className="font-mono font-black">{(cartTotals.toppingsSubtotal).toFixed(2)} ر.س</span>
                          </div>
                        )}
                        {cartTotals.totalDiscounts > 0 && (
                          <div className="flex justify-between text-emerald-600 font-black border-t border-dashed border-slate-200 pt-2">
                            <span>إجمالي قيمة الخصومات المطبقة:</span>
                            <span className="font-mono animate-pulse">-{cartTotals.totalDiscounts.toFixed(2)} ر.س</span>
                          </div>
                        )}

                        <hr className="my-2 border-dashed border-slate-200" />
                        
                        <div className="flex justify-between text-slate-900 font-black text-sm">
                          <span className="text-slate-800 font-extrabold text-xs">صافي الحساب المستحق:</span>
                          <span className="text-2xl text-pink-600 font-black font-mono">
                            {cartTotals.finalTotal.toFixed(2)} ر.س
                          </span>
                        </div>
                      </div>

                      {/* PAYMENT METHOD */}
                      <div className="space-y-4 pt-4 border-t border-slate-200">
                        <div>
                          <span className="text-[10px] font-black text-slate-400 block mb-2 mr-1">طريقة الدفع المختارة:</span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setPaymentMethod('cash')}
                              className={`py-3 px-4 rounded-xl font-black text-xs transition border-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                                paymentMethod === 'cash'
                                  ? 'bg-pink-500 border-pink-600 text-white'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-pink-300'
                              }`}
                            >
                              <Coins className="w-4 h-4" />
                              <span>نقدي / كاش</span>
                            </button>
                            <button
                              onClick={() => setPaymentMethod('card')}
                              className={`py-3 px-4 rounded-xl font-black text-xs transition border-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                                paymentMethod === 'card'
                                  ? 'bg-pink-500 border-pink-700 text-white'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-pink-300'
                              }`}
                            >
                              <span>🏦</span>
                              <span>تحويل بنكي</span>
                            </button>
                          </div>
                        </div>

                        {/* Bank Transfer Sub-options */}
                        {paymentMethod === 'card' && (
                          <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3.5 space-y-2.5 font-sans">
                            <span className="text-[10px] font-black text-slate-500 block mr-1">بوابة التحويل المستهدفة:</span>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: 'stc', name: 'STC Pay', icon: '📱' },
                                { id: 'barq', name: 'barq', icon: '⚡' },
                                { id: 'urpay', name: 'urpay', icon: '💳' },
                                { id: 'other', name: 'بنك آخر', icon: '🏦' }
                              ].map(sub => {
                                const isSel = bankSubMethod === sub.id;
                                return (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    onClick={() => setBankSubMethod(sub.id)}
                                    className={`py-2 px-3 text-[11px] font-black rounded-xl border-2 transition cursor-pointer flex items-center justify-between gap-1.5 ${
                                      isSel
                                        ? 'bg-pink-500 border-pink-600 text-white shadow-sm'
                                        : 'bg-white border-slate-200 hover:border-pink-300 text-slate-700'
                                    }`}
                                  >
                                    <span className="truncate">{sub.name}</span>
                                    <span className="text-sm">{sub.icon}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* SUBMIT CHECKOUT TRANSACTION */}
                        <button
                          onClick={handleCompleteCheckout}
                          className="w-full bg-pink-500 hover:bg-pink-600 text-white font-black py-4.5 rounded-2xl border-b-4 border-pink-700 hover:border-pink-800 transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_14px_rgba(236,72,153,0.2)] text-sm"
                          id="btn-checkout"
                        >
                          <span>🍦</span>
                          <span>تأكيد واعتماد الفاتورة</span>
                          <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs font-mono font-black">
                            {cartTotals.finalTotal.toFixed(2)} ر.س
                          </span>
                        </button>

                      </div>

                    </div>
                  )}

                </div>
              </div>

            </section>

          </div>
        ) : activeTab === 'OnlineOrders' ? (
          
          /* --- TAB: ONLINE SELF-SERVICE ORDERS --- */
          <div className="space-y-6">
            
            {/* MINI COMPACT QUICK STATS */}
            <div className="bg-white rounded-3xl p-4 border-4 border-slate-800 shadow-[4px_4px_0px_rgba(30,41,59,0.05)]">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  <span className="text-xs font-black text-slate-705 font-sans">ملخص حالة الطلبات السحابية:</span>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full lg:w-auto">
                  <div className="bg-amber-50/50 border-2 border-amber-200 rounded-xl px-3 py-1.5 flex items-center justify-between sm:justify-start gap-2 flex-1 sm:flex-initial">
                    <span className="text-[10.5px] font-bold text-amber-700">الواردة 🕒</span>
                    <span className="text-xs font-black font-mono text-amber-600">{onlineOrders.filter(o => o.status === 'pending').length}</span>
                  </div>
                  
                  <div className="bg-blue-50/50 border-2 border-blue-200 rounded-xl px-3 py-1.5 flex items-center justify-between sm:justify-start gap-2 flex-1 sm:flex-initial">
                    <span className="text-[10.5px] font-bold text-blue-700">جاري التحضير 👨‍🍳</span>
                    <span className="text-xs font-black font-mono text-blue-600">{onlineOrders.filter(o => o.status === 'accepted').length}</span>
                  </div>
                  
                  <div className="bg-emerald-50/50 border-2 border-emerald-200 rounded-xl px-3 py-1.5 flex items-center justify-between sm:justify-start gap-2 flex-1 sm:flex-initial">
                    <span className="text-[10.5px] font-bold text-emerald-700">جاهزة للاستلام ✅</span>
                    <span className="text-xs font-black font-mono text-emerald-600">{onlineOrders.filter(o => o.status === 'prepared').length}</span>
                  </div>
                  
                  <div className="bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-1.5 flex items-center justify-between sm:justify-start gap-2 flex-1 sm:flex-initial">
                    <span className="text-[10.5px] font-bold text-slate-700">الإجمالي 📊</span>
                    <span className="text-xs font-black font-mono text-slate-800">{onlineOrders.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN ORDERS VIEW LIST */}
            <div className="bg-white rounded-3xl p-6 border-4 border-slate-800 shadow-[8px_8px_0px_0px_rgba(30,41,59,0.1)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-dashed border-slate-150">
                <h3 className="font-black text-slate-800 text-base border-r-4 border-pink-500 pr-3">قائمة الطلبات السحابية الواردة</h3>
                
                {/* VIEW LAYOUT SWITCHERS */}
                <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto font-sans">
                  {onlineOrders.some(o => o.status === 'prepared' || o.status === 'cancelled') && (
                    <button
                      type="button"
                      onClick={handleClearProcessedOnlineOrders}
                      className="px-3 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer flex items-center gap-1 bg-red-50 hover:bg-red-105 text-red-650 border border-red-200 shadow-sm active:scale-95 duration-100"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      <span>حذف الطلبات المنتهية 🧹</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setOnlineViewLayout('grid')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                        onlineViewLayout === 'grid'
                          ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-750'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>عرض شبكة 👥</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOnlineViewLayout('list')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                        onlineViewLayout === 'list'
                          ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-750'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>عرض قائمة 📄</span>
                    </button>
                  </div>
                </div>
              </div>

              {onlineOrders.length === 0 ? (
                <div className="text-center py-16 px-4 space-y-4">
                  <span className="text-6xl inline-block animate-pulse">🍦</span>
                  <h4 className="text-lg font-black text-slate-700">لا توجد طلبات خدمة ذاتية بعد!</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto font-bold font-sans">
                    افتح "رابط العميل" في نافذة ثانوية أو امسح الباركود، وارسل طلب تجريبي لتشاهد السحر والسرعة!
                  </p>
                </div>
              ) : (
                <div className={onlineViewLayout === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "grid grid-cols-1 gap-3.5"}>
                  {onlineOrders.map((order) => {
                    const statusConfig = {
                      pending: { badgeBg: 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse', label: '🕒 جديد قيد الانتظار' },
                      accepted: { badgeBg: 'bg-blue-50 border-blue-200 text-blue-700', label: '👨‍🍳 تم الاستلام وجاري التحضير' },
                      prepared: { badgeBg: 'bg-emerald-50 border-emerald-250 text-emerald-700', label: '🔔 تم التجهيز وجاهز للاستلام' },
                      cancelled: { badgeBg: 'bg-red-50 border-red-200 text-red-700', label: '❌ ملغى' }
                    }[order.status] || { badgeBg: 'bg-slate-50 border-slate-200 text-slate-700', label: order.status };

                    const isList = onlineViewLayout === 'list';

                    return (
                      <div 
                        key={order.id} 
                        className={`rounded-2xl border-2 transition-all duration-200 ${
                          isList 
                            ? 'p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4' 
                            : 'p-4 flex flex-col justify-between gap-3.5'
                        } ${
                          order.status === 'pending'
                            ? 'bg-amber-50/20 border-amber-300 shadow-sm'
                            : order.status === 'accepted'
                            ? 'bg-blue-50/10 border-blue-300 shadow-sm'
                            : order.status === 'prepared'
                            ? 'bg-emerald-50/5 border-emerald-250 opacity-95'
                            : 'bg-slate-50/85 border-slate-200 opacity-60'
                        }`}
                      >
                        {/* 1. Header/Info Section */}
                        <div className={`flex justify-between gap-2.5 font-sans ${
                          isList 
                            ? 'flex-row lg:flex-col lg:justify-center items-center lg:items-start lg:pl-4 lg:border-l lg:border-dashed lg:border-slate-200 shrink-0 lg:w-[170px]' 
                            : 'items-center border-b border-dashed pb-2.5 border-slate-200'
                        }`}>
                          <div className="space-y-0.5">
                            <span className="text-[9.5px] font-mono font-bold block text-slate-400">رقم: {order.orderNumber}</span>
                            <span className="text-xs sm:text-sm font-black text-slate-800 block">
                              👤 {order.customerName}
                            </span>
                            {isList && (
                              <span className="text-[10px] text-slate-400 font-bold block">
                                {order.timestamp.split('،')[1]?.trim() || order.timestamp}
                              </span>
                            )}
                          </div>

                          <div className="text-left flex flex-col items-end shrink-0">
                            {!isList && (
                              <span className="text-[10px] text-slate-400 font-bold mb-1">
                                {order.timestamp.split('،')[1]?.trim() || order.timestamp}
                              </span>
                            )}
                            <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-lg border ${statusConfig.badgeBg}`}>
                              {statusConfig.label}
                            </span>
                          </div>
                        </div>

                        {/* 2. Items List Section */}
                        <div className={`space-y-2 flex-1 min-w-0 ${isList ? 'my-1' : ''}`}>
                          {order.items.map((it, idx) => (
                            <div key={idx} className="bg-white/80 p-2 rounded-xl border border-slate-200 text-[11px] space-y-1 font-sans">
                              <div className="flex justify-between font-black text-slate-800">
                                <span>{it.container.name} ×{it.quantity}</span>
                                <span className="font-mono text-slate-500">{(it.basePrice * it.quantity).toFixed(2)} ر.س</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                <span>🥣 النكهات:</span>
                                <span className="text-slate-600 font-medium">{it.flavors.map(f => `${f.emoji} ${f.name}`).join('، ')}</span>
                              </div>
                              {it.toppings.length > 0 && (
                                <div className="text-[10px] text-emerald-700 font-black flex items-center gap-1">
                                  <span>✨ الإضافات:</span>
                                  <span className="text-emerald-600 font-medium">{it.toppings.map(t => `${t.emoji} ${t.name}`).join(' + ')}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* 3. Financials & Action Buttons Section */}
                        <div className={`mt-1 ${
                          isList 
                            ? 'flex flex-row lg:flex-col justify-between lg:justify-center items-center lg:items-stretch lg:pr-4 lg:border-r lg:border-dashed lg:border-slate-200 shrink-0 lg:w-[220px] gap-2' 
                            : 'pt-3 border-t border-dashed border-slate-200'
                        }`}>
                          {/* Payment information and totals */}
                          <div className={`space-y-1 font-sans text-right ${isList ? 'shrink-0 lg:text-left' : ''}`}>
                            <div className="flex items-center gap-2 lg:justify-between text-[11px] font-bold text-slate-500">
                              <span className="opacity-75">الإجمالي:</span>
                              <span className="text-xs sm:text-sm font-black text-pink-600 font-mono">{order.total.toFixed(2)} ريال</span>
                            </div>

                            <div className="flex items-center gap-1.5 lg:justify-between text-[10px] font-bold text-slate-400">
                              <span className="opacity-75">الدفع:</span>
                              <span className="text-slate-700 font-black inline-flex items-center">
                                {order.paymentMethod === 'card' ? (
                                  <span className="inline-flex items-center gap-1">
                                    <span>💳 شبكة</span>
                                    <span className="bg-pink-100/70 border border-pink-200 text-pink-600 px-1.5 py-0.5 rounded-md text-[8.5px] font-black leading-none">
                                      {order.bankSubMethod === 'stc' ? 'STC Pay' :
                                       order.bankSubMethod === 'barq' ? 'barq' :
                                       order.bankSubMethod === 'urpay' ? 'urpay' : 'بنك'}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-slate-600">
                                    <Coins className="w-3 h-3 text-amber-500" />
                                    <span>نقدي</span>
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Action button triggers - scaled down & compact */}
                          <div className={`flex gap-1.5 items-center ${isList ? 'w-auto lg:w-full items-center justify-end' : 'mt-2.5'}`}>
                            {order.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleAcceptOnlineOrder(order.id)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10.5px] py-1.5 px-3 rounded-lg transition cursor-pointer text-center whitespace-nowrap active:scale-95 duration-100 flex-1"
                                >
                                  ١. تم الاستلام وجاري التحضير 👨‍🍳⏳
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancelOnlineOrder(order.id)}
                                  className="bg-red-50 hover:bg-red-150 border border-red-200 text-red-600 font-black text-[10.5px] py-1.5 px-2 rounded-lg transition cursor-pointer text-center active:scale-95 duration-100 text-nowrap"
                                >
                                  رفض ❌
                                </button>
                              </>
                            )}

                            {order.status === 'accepted' && (
                              <button
                                type="button"
                                onClick={() => handlePrepareOnlineOrder(order)}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] py-2 px-3 rounded-lg transition cursor-pointer text-center active:scale-95 duration-100 flex-1"
                              >
                                ٢. تم تجهيز الطلب وجاهز للاستلام 🔔✅
                              </button>
                            )}

                            {order.status === 'prepared' && (
                              <div className="flex-1 bg-emerald-50 text-emerald-700 font-extrabold text-[10px] py-1.5 px-2.5 inline-flex items-center justify-center rounded-lg text-center border border-emerald-150">
                                جاهز للاستلام وبانتظار العميل 🍦⏳
                              </div>
                            )}

                            {order.status === 'cancelled' && (
                              <div className="flex-1 bg-slate-100 text-slate-500 font-bold text-[10px] py-1.5 px-2.5 inline-flex items-center justify-center rounded-lg text-center border border-slate-200">
                                تم إلغاء الطلب ❌
                              </div>
                            )}

                            {/* Individual Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteOnlineOrder(order.id, order.orderNumber)}
                              className="bg-red-50 hover:bg-red-105 text-red-600 p-2.5 rounded-lg border border-red-200 transition cursor-pointer text-center active:scale-95 duration-100 shrink-0"
                              title="حذف الطلب نهائياً"
                            >
                              <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        ) : activeTab === 'OnlineSetup' ? (
          
          /* --- TAB: ONLINE SELF-SERVICE SETUP & QR --- */
          <div className="space-y-6">
            
            {/* LINK INFORMATION CARD */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-3xl p-6 border-4 border-emerald-700 shadow-[8px_8px_0px_rgba(30,41,59,0.1)] flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">🔗</span>
                  <h2 className="text-xl font-black">رابط الخدمة الذاتية والطلب الذاتي (أونلاين)</h2>
                </div>
                <p className="text-xs text-emerald-100 font-extrabold max-w-2xl leading-relaxed">
                  قم بمشاركة هذا الرابط مع عملائك، أو افتحه في شاشة تابلت إضافية مخصصة للجمهور عند طابور المحل، لتمكينهم من تركيب طلباتهم بأنفسهم والدفع عند الاستلام. ستظهر طلباتهم في صفحة المطبخ فوراً مع تنبيهات صوتية حية!
                </p>
                <div className="bg-emerald-900/45 p-2.5 rounded-xl text-xs font-mono font-bold select-all inline-block border border-white/10 mt-1.5" dir="ltr">
                  {window.location.origin + window.location.pathname}#/
                </div>
              </div>
              <a
                href="#/"
                target="_blank"
                rel="noreferrer"
                className="bg-white text-emerald-700 hover:bg-emerald-50 font-black px-6 py-3.5 rounded-2xl transition hover:scale-[1.02] shadow-lg flex items-center gap-2 shrink-0 text-xs text-center border-b-4 border-emerald-200 cursor-pointer"
              >
                <span>فتح صفحة الطلب الذاتي للعميل 🚀</span>
              </a>
            </div>

            {/* PREPARATION BANNER & DESK DISPLAY CARD FOR CUSTOMERS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-white rounded-3xl p-8 border-4 border-slate-800 shadow-[8px_8px_0px_rgba(30,41,59,0.1)] flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center text-3xl">📱</div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-slate-800">بطاقة طاولة الكاونتر الذكية 🍦</h3>
                  <p className="text-xs text-slate-400 font-bold max-w-md leading-relaxed">
                    قم بفتح هذه الشاشة على تابلت جانبي أو لافتة عند كاونتر الاستلام. يسهل للعملاء تصفح المنيو وتجهيز أكوابهم دون طابور الانتظار!
                  </p>
                </div>
                
                {/* MOCK QR / PRINT BANNER DESIGN */}
                <div className="border-4 border-dashed border-pink-400 p-6 rounded-3xl bg-pink-50/30 w-full max-w-xs space-y-4">
                  <div className="mx-auto w-32 h-32 bg-slate-900 rounded-2xl p-3 flex flex-col justify-between items-center text-white relative shadow-md">
                    <div className="grid grid-cols-4 gap-1 w-full h-full opacity-95">
                      <div className="rounded-sm bg-white" />
                      <div className="rounded-sm bg-transparent" />
                      <div className="rounded-sm bg-white" />
                      <div className="rounded-sm bg-white" />
                      <div className="rounded-sm bg-transparent" />
                      <div className="rounded-sm bg-white" />
                      <div className="rounded-sm bg-transparent" />
                      <div className="rounded-sm bg-white" />
                      <div className="rounded-sm bg-white" />
                      <div className="rounded-sm bg-transparent" />
                      <div className="rounded-sm bg-white" />
                      <div className="rounded-sm bg-white" />
                      <div className="rounded-sm bg-transparent" />
                      <div className="rounded-sm bg-white" />
                      <div className="rounded-sm bg-transparent" />
                      <div className="rounded-sm bg-white" />
                    </div>
                    {/* Floating Center Icecream */}
                    <span className="absolute inset-0 m-auto w-10 h-10 bg-white border-2 border-slate-900 rounded-lg flex items-center justify-center text-xl shadow">🍦</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] bg-pink-100 text-pink-600 px-2.5 py-0.5 rounded-full font-black">امسح لتبدأ التصميم</span>
                    <h4 className="text-xs font-black text-slate-800">اصنع كوب الآيس كريم الخاص بك!</h4>
                    <span className="text-[9px] text-slate-400 font-mono block select-all">{window.location.origin + window.location.pathname}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-800 hover:bg-slate-900 border-b-4 border-slate-950 text-white font-black text-xs py-3 px-6 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة باركود كود الطاولة للعملاء 🖨️</span>
                </button>
              </div>

              <div className="bg-white rounded-3xl p-8 border-4 border-slate-800 shadow-[8px_8px_0px_rgba(30,41,59,0.1)] space-y-6">
                <div className="flex items-center gap-3 border-b-2 border-slate-200 pb-4 font-sans">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">كيفية البدء واستخدام شاشة الخدمة الذاتية</h3>
                    <p className="text-[10px] text-slate-400 font-bold">خطوات بسيطة لبدء استقبال الطلبات السحابية التفاعلية</p>
                  </div>
                </div>

                <div className="space-y-4 text-right">
                  <div className="flex gap-4 items-start">
                    <span className="bg-pink-100 text-pink-600 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">١</span>
                    <div>
                      <h4 className="text-xs font-black text-slate-800">افتح رابط الطلب الذاتي للجمهور</h4>
                      <p className="text-[10px] text-slate-500 font-bold leading-relaxed mt-0.5">
                        قم بالضغط على الزر في الأعلى لفتح الواجهة المصممة للعميل. يمكنك تشغيلها على أجهزة iPad أو هواتف العملاء أو أي شاشة تفاعلية بالمحل.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <span className="bg-emerald-100 text-emerald-600 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">٢</span>
                    <div>
                      <h4 className="text-xs font-black text-slate-800">يقوم العميل بابتكار الأكواب وجمعها في سلتهم</h4>
                      <p className="text-[10px] text-slate-500 font-bold leading-relaxed mt-0.5">
                        سيقوم العميل باختيار حجم الكوب وتمرير النكهات (المانجو، الفراولة، الشوكولاتة...) والصلصات والمكسرات وجمعها في سلة طلباتهم بسهولة.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <span className="bg-blue-100 text-blue-600 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">٣</span>
                    <div>
                      <h4 className="text-xs font-black text-slate-800">استلام فوري للطلب بنغمة تنبيه صوتية حية!</h4>
                      <p className="text-[10px] text-slate-500 font-bold leading-relaxed mt-0.5">
                        بمجرد أن يرسل العميل طلبه، سيصدر كمبيوتر المطبخ صوتاً ويدخل الطلب كـ "قيد الانتظار". بمجرد قبولك له وتجهيزه، يحصل العميل على تحديث فوري مباشر لحالة طلبه على شاشته!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border-2 border-dashed border-yellow-250 p-4 rounded-2xl text-[10px] font-bold text-yellow-800 leading-relaxed font-sans">
                  ⚠️ <strong>تنبيه الأمان والخصوصية:</strong> هذا النظام يعمل بقاعدة بيانات حرة سحابية متكاملة لربط العملاء بالبائعين في الزمن الحقيقي، يرجى الترحيب بالعملاء وعرض شاشة البث الحية لمساعدتهم على تسريع استلام طلباتهم.
                </div>
              </div>

            </div>

          </div>
        ) : activeTab === 'History' ? (
          
          /* --- TAB 2: HISTORY, SALES LEDGER, ANALYTICS --- */
          <div className="space-y-6">
            
            {/* INLINE GENERAL DASHBOARD / STATISTICS LEDGER */}
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              
              <div className="bg-white rounded-2xl p-5 border-4 border-slate-800 shadow-[4px_4px_0px_rgba(30,41,59,0.1)] flex flex-col justify-between">
                <div className="flex justify-between items-start text-xs text-slate-400 font-extrabold uppercase">
                  <span>إجمالي إيراد المبيعات</span>
                  <span className="text-xl">💰</span>
                </div>
                <div className="mt-4">
                  <span className="block text-2xl font-black text-pink-650 font-mono">
                    {salesStats.totalRevenue.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block font-black">عملات بالريال السعودي</span>
                  
                  <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200 flex justify-between text-[9px] font-bold text-slate-500">
                    <span>🏬 كاشير: {(salesStats.totalRevenue - salesStats.onlineRevenue).toFixed(2)}</span>
                    <span>🌐 أونلاين: {salesStats.onlineRevenue.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border-4 border-slate-800 shadow-[4px_4px_0px_rgba(30,41,59,0.1)] flex flex-col justify-between">
                <div className="flex justify-between items-start text-xs text-slate-400 font-extrabold uppercase">
                  <span>مبيعات بسكوتات الآيس كريم</span>
                  <span className="text-xl">🍦</span>
                </div>
                <div className="mt-4">
                  <span className="block text-2xl font-black text-slate-800 font-mono">
                    {salesStats.coneCount}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block font-black">بسكوت وافل مقرمش</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border-4 border-slate-800 shadow-[4px_4px_0px_rgba(30,41,59,0.1)] flex flex-col justify-between">
                <div className="flex justify-between items-start text-xs text-slate-400 font-extrabold uppercase">
                  <span>مبيعات أكواب الآيس كريم</span>
                  <span className="text-xl">🍨</span>
                </div>
                <div className="mt-4">
                  <span className="block text-2xl font-black text-slate-800 font-mono">
                    {salesStats.cupCount}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block font-black">أكواب دائرية</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border-4 border-slate-800 shadow-[4px_4px_0px_rgba(30,41,59,0.1)] flex flex-col justify-between">
                <div className="flex justify-between items-start text-xs text-slate-400 font-extrabold uppercase">
                  <span>إجمالي الخصومات الممنوحة</span>
                  <span className="text-xl">✂️</span>
                </div>
                <div className="mt-4">
                  <span className="block text-2xl font-black text-amber-550 font-mono">
                    {salesStats.totalDiscountsGiven.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block font-black font-mono">وفر أسعدنا به عملاءنا</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border-4 border-slate-800 shadow-[4px_4px_0px_rgba(30,41,59,0.1)] col-span-2 lg:col-span-1 flex flex-col justify-between">
                <div className="flex justify-between items-start text-xs text-slate-400 font-extrabold uppercase">
                  <span>طلبات تم تنفيذها</span>
                  <span className="text-xl">📋</span>
                </div>
                <div className="mt-4">
                  <span className="block text-2xl font-black text-emerald-600 font-mono">
                    {salesStats.ordersCount}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block font-black">فواتير اليوم الإجمالية</span>

                  <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200 flex justify-between text-[9px] font-bold text-emerald-700">
                    <span>🏬 كاشير: {salesStats.posOrdersCount}</span>
                    <span>🌐 أونلاين: {salesStats.onlineOrdersCount}</span>
                  </div>
                </div>
              </div>

            </section>

            {/* TRANSACTIONS LEDGER LIST (جدول سجل الفواتير والمتحصلات) */}
            <div className="bg-white rounded-3xl p-6 border-4 border-slate-800 shadow-[8px_8px_0px_0px_rgba(30,41,59,0.1)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-4 border-slate-100 mb-6">
                <div>
                  <h2 className="font-black text-slate-800 text-lg">دفتر المبيعات والفواتير الصادرة اليوم</h2>
                  <p className="text-xs text-slate-400 mt-1.5 font-bold">يمكنك مراجعة جميع مبيعات النوبات وتتبع الفواتير والطباعة أو الاسترجاع.</p>
                </div>
                {salesHistory.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="text-xs bg-red-50 hover:bg-red-100 border-2 border-red-200 text-red-650 py-2.5 px-4 rounded-xl font-black transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    🗑️ مسح وإخلاء سجل الـ POS
                  </button>
                )}
              </div>

              {/* filters render first if salesHistory is not empty */}
              {salesHistory.length > 0 && (
                <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-4 mb-6">
                  <div className="text-xs font-black text-slate-700 mb-3 flex items-center gap-2">
                    <span className="text-sm">🔍</span>
                    <span>خيارات فلترة وتصفية الفواتير النشطة:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Search query */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-500 font-extrabold" htmlFor="ledger-search-input">
                        البحث بالنص:
                      </label>
                      <input
                        type="text"
                        id="ledger-search-input"
                        placeholder="رقم الفاتورة، اسم العميل، صنف..."
                        value={ledgerSearch}
                        onChange={(e) => setLedgerSearch(e.target.value)}
                        className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400 transition"
                      />
                    </div>

                    {/* Order Source select */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-500 font-extrabold" htmlFor="ledger-source-select">
                        مصدر وطبيعة الطلب:
                      </label>
                      <select
                        id="ledger-source-select"
                        value={ledgerSourceFilter}
                        onChange={(e) => setLedgerSourceFilter(e.target.value as 'all' | 'pos' | 'online')}
                        className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-400 transition"
                      >
                        <option value="all">الكل (كاشير + أونلاين)</option>
                        <option value="pos">🏬 كاشير نقاط البيع (POS)</option>
                        <option value="online">🌐 خدمة ذاتية سحابي (أونلاين)</option>
                      </select>
                    </div>

                    {/* Payment Method select */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-500 font-extrabold" htmlFor="ledger-pay-select">
                        طريقة الدفع في الوعاء:
                      </label>
                      <select
                        id="ledger-pay-select"
                        value={ledgerPaymentMethodFilter}
                        onChange={(e) => setLedgerPaymentMethodFilter(e.target.value)}
                        className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-400 transition"
                      >
                        <option value="all">الأشكال والأنواع كافة (الكل)</option>
                        <option value="cash">💵 نقداً / كاش فقط</option>
                        <option value="card">🏦 جميع عمليات التحويل والشبكة</option>
                        <option value="stc">└ STC Pay</option>
                        <option value="barq">└ barq</option>
                        <option value="urpay">└ urpay</option>
                        <option value="other">└ بنوك أخرى</option>
                      </select>
                    </div>

                    {/* Container filter */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-500 font-extrabold" htmlFor="ledger-container-select">
                        نوع وعاء التقديم:
                      </label>
                      <select
                        id="ledger-container-select"
                        value={ledgerContainerFilter}
                        onChange={(e) => setLedgerContainerFilter(e.target.value)}
                        className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-400 transition"
                      >
                        <option value="all">كل الأوعية والمخاريط</option>
                        <option value="cup">🍨 كوب آيس كريم</option>
                        <option value="cone">🍦 بسكوت مقرمش</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-dashed border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 bg-pink-50 border border-pink-200 text-pink-700 font-bold px-2.5 py-1 rounded-xl text-[11px]">
                        <span>عدد الفواتير المصفاة:</span>
                        <span className="font-mono font-black">{filteredSalesHistory.length}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold px-2.5 py-1 rounded-xl text-[11px]">
                        <span>إجمالي المبيعات المصفاة:</span>
                        <span className="font-mono font-black">{filteredSalesHistory.reduce((sum, sale) => sum + sale.total, 0).toFixed(2)} ر.س</span>
                      </span>
                    </div>

                    {(ledgerSearch !== '' || ledgerPaymentMethodFilter !== 'all' || ledgerContainerFilter !== 'all' || ledgerSourceFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setLedgerSearch('');
                          setLedgerPaymentMethodFilter('all');
                          setLedgerContainerFilter('all');
                          setLedgerSourceFilter('all');
                        }}
                        className="text-[10px] font-black hover:underline text-red-600 bg-red-50 hover:bg-red-100/50 border border-red-200 py-1.5 px-3 rounded-xl transition cursor-pointer flex items-center gap-1"
                      >
                        🔄 إعادة تعيين التصفية الافتراضية
                      </button>
                    )}
                  </div>
                </div>
              )}

              {salesHistory.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center justify-center">
                  <span className="text-5xl mb-3">📁</span>
                  <p className="text-base font-black text-slate-700">لا يوجد مبيعات مسجلة ومحفوظة</p>
                  <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed font-bold">
                    بمجرد إضافة آيس كريم في سلة المشتريات وإتمام المحاسبة والقبول، سيتم تسجيل الأرصدة وإدراج التقارير الإيجابية هنا تلقائياً.
                  </p>
                  <button
                    onClick={() => setActiveTab('POS')}
                    className="mt-6 bg-pink-50 border-2 border-pink-300 text-pink-650 text-xs font-black py-2.5 px-6 rounded-xl hover:bg-pink-100 transition cursor-pointer"
                  >
                    الذهاب وتجربة نقاط البيع 🍦
                  </button>
                </div>
              ) : filteredSalesHistory.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center justify-center bg-slate-50 border-4 border-dashed border-slate-200 rounded-3xl font-sans">
                  <span className="text-4xl mb-2">🔍</span>
                  <p className="text-sm font-black text-slate-700">لا توجد نتائج تطابق خيارات التصفية النشطة</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm font-bold">
                    يرجى تعديل خيارات البحث أو التصفية لتنظيف حقول العرض.
                  </p>
                  <button
                    onClick={() => {
                      setLedgerSearch('');
                      setLedgerPaymentMethodFilter('all');
                      setLedgerContainerFilter('all');
                    }}
                    className="mt-4 bg-pink-50 border-2 border-pink-300 text-pink-650 text-xs font-black py-2 px-5 rounded-xl hover:bg-pink-100 transition cursor-pointer"
                  >
                    تصفير الفلاتر والبحث من جديد 🔄
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto text-slate-800">
                  <table className="w-full text-right text-xs bg-white">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider">
                        <th className="pb-3 text-right">رقم الفاتورة</th>
                        <th className="pb-3 text-right">وقت وتاريخ الطلب</th>
                        <th className="pb-3 text-right">مكونات وتفاصيل الفاتورة</th>
                        <th className="pb-3 text-right">الخصومات الملازمة</th>
                        <th className="pb-3 text-right">المبلغ الكلي</th>
                        <th className="pb-3 text-center">أجراءات الصندوق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-100">
                      {filteredSalesHistory.map((sale) => (
                        <tr key={sale.id} className="hover:bg-pink-50/20 group transition">
                          <td className="py-4 font-mono font-black text-pink-600">
                            <div>{sale.orderNumber}</div>
                            {sale.customerName && (
                              <div className="text-[10px] text-slate-500 font-sans font-bold mt-0.5 max-w-[120px] truncate" title={sale.customerName}>
                                👤 {sale.customerName}
                              </div>
                            )}
                            {sale.isOnline || sale.calculatedDiscountName?.includes('أونلاين') ? (
                              <span className="inline-block bg-sky-50 border border-sky-150 text-sky-700 text-[8.5px] font-black px-1.5 py-0.5 rounded-md mt-1 font-sans">
                                🌐 خدمة سحابية أونلاين
                              </span>
                            ) : (
                              <span className="inline-block bg-pink-50 border border-pink-150 text-pink-650 text-[8.5px] font-black px-1.5 py-0.5 rounded-md mt-1 font-sans">
                                🏬 كاشير نقاط بيع
                              </span>
                            )}
                          </td>
                          <td className="py-4 text-slate-500 font-bold">{sale.timestamp}</td>
                          <td className="py-4 max-w-xs">
                            <div className="space-y-1">
                              {sale.items.map((it, i) => (
                                <p key={i} className="text-[11px] text-slate-750 font-black line-clamp-1">
                                  {it.container.name} {it.quantity}x • نكهات ({it.flavors.map(f => f.emoji).join('')})
                                </p>
                              ))}
                            </div>
                          </td>
                          <td className="py-4 font-black text-emerald-605">{sale.calculatedDiscountName}</td>
                          <td className="py-4 font-mono font-black text-slate-850 text-sm">
                            {sale.total.toFixed(2)} ريال{' '}
                            {sale.paymentMethod === 'card' ? (
                              <span
                                className="inline-flex items-center gap-1 text-[9px] font-black text-slate-600 bg-slate-100 border border-slate-200 py-0.5 px-1.5 rounded-md"
                                title="تحويل بنكي"
                              >
                                🏦{' '}
                                {sale.bankSubMethod === 'stc'
                                  ? 'STC Pay'
                                  : sale.bankSubMethod === 'barq'
                                  ? 'barq'
                                  : sale.bankSubMethod === 'urpay'
                                  ? 'urpay'
                                  : sale.bankSubMethod === 'other'
                                  ? 'بنك آخر'
                                  : 'تحويل بنكي'}
                              </span>
                            ) : (
                              '💵'
                            )}
                          </td>
                          <td className="py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {/* Reprint */}
                              <button
                                onClick={() => setCompletedOrder(sale)}
                                className="bg-pink-50 text-pink-600 hover:bg-pink-100 py-1.5 px-3 rounded-lg font-black text-[10px] transition flex items-center gap-1 border border-pink-200 cursor-pointer"
                                title="عرض وإعادة طباعة السجل"
                              >
                                <Printer className="w-3 h-3" />
                                <span>فاتورة</span>
                              </button>
                              
                              {/* Refund */}
                              <button
                                onClick={() => handleRefundSale(sale.id, sale.orderNumber)}
                                className="bg-red-50 text-red-650 hover:bg-red-100 py-1.5 px-3 rounded-lg font-black text-[10px] transition flex items-center gap-1 border border-red-200 cursor-pointer"
                                title="إرجاع واسترداد القيمة"
                              >
                                <Undo2 className="w-3 h-3" />
                                <span>إرجاع</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        ) : (
          
          /* --- TAB 3: ADMIN/PRICES MANAGEMENT --- */
          <div className="space-y-6">
            
            {/* Header section with Reset */}
            <div className="bg-white rounded-3xl p-6 border-4 border-slate-800 shadow-[8px_8px_0px_0px_rgba(30,41,59,0.1)] flex flex-col md:flex-row md:items-center md:justify-between gap-4 font-sans">
              <div>
                <h2 className="font-sans font-black text-slate-800 text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5 text-amber-500 animate-spin-slow" />
                  <span>إعدادات النظام وضبط الأسعار والتوفر للآيس كريم</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1.5 font-bold">يمكنك هنا إيقاف استقبال الطلبات للموقع بالكامل، تحديد توفر الأوعية، النكهات، والحلويات، وتحديث الأسعار بالريال السعودي فوراً وسحابياً.</p>
              </div>
              <button
                onClick={handleResetAllPrices}
                className="text-xs bg-amber-50 hover:bg-amber-100 border-2 border-amber-200 text-amber-700 py-2.5 px-4 rounded-xl font-black transition flex items-center justify-center gap-1.5 cursor-pointer self-start md:self-auto font-sans"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة النواعم والأسعار الافتراضية</span>
              </button>
            </div>

            {/* FULL-SITE ONLINE ORDERS PAUSE CONTROL */}
            <div className="bg-white rounded-3xl p-6 border-4 border-slate-800 shadow-[8px_8px_0px_0px_rgba(30,41,59,0.1)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-sans">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${isOrdersStopped ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  <Settings className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-850 text-sm">استقبال الطلبات للموقع كاملاً 🌐</h3>
                  <p className="text-xs text-slate-400 mt-1 font-bold">
                    {isOrdersStopped 
                      ? 'تم إيقاف استقبال الطلبات السحابية مؤقتاً للموقع بالكامل من قبل الإدارة.' 
                      : 'استقبال الطلبات نشط وبخير، يمكن للعملاء إرسال طلباتهم في الزمن الحقيقي.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleToggleOrdersStopped(!isOrdersStopped)}
                className={`py-2.5 px-6 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 border-2 ${
                  isOrdersStopped
                    ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-emerald-50 border-emerald-250 text-emerald-600 hover:bg-emerald-100'
                }`}
              >
                <span>{isOrdersStopped ? '🔴 استقبال الطلبات: متوقف' : '🟢 استقبال الطلبات: نشط ومفعّل'}</span>
              </button>
            </div>

            {/* Grid of editable categories */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
              
              {/* CATEGORY 1: CONTAINERS */}
              <div className="bg-white rounded-3xl p-6 border-4 border-slate-800 shadow-[8px_8px_0px_rgba(30,41,59,0.1)] space-y-4">
                <h3 className="font-black text-slate-800 text-sm border-r-4 border-pink-500 pr-2 pb-1 flex items-center justify-between">
                  <span>1. أوعية التقديم</span>
                  <span className="text-xs text-slate-400 font-bold">({containers.length} أنواع)</span>
                </h3>
                <div className="space-y-4">
                  {containers.map((opt) => (
                    <div key={opt.id} className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-200 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl select-none">{opt.id === 'cone' ? '🍦' : '🍨'}</span>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-black text-slate-800 truncate">{opt.name}</h4>
                          <span className="text-[10px] text-slate-400 font-bold block">{opt.id === 'cone' ? 'Cone' : 'Cup'}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 shrink-0">السعر:</span>
                        <div className="flex items-center bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-inner flex-1">
                          <button
                            onClick={() => handleUpdatePrice('container', opt.id, Math.max(0, opt.price - 0.5))}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black w-8 h-8 flex items-center justify-center transition active:scale-95"
                            title="ناقص 0.5 ريال"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={opt.price}
                            onChange={(e) => handleUpdatePrice('container', opt.id, parseFloat(e.target.value) || 0)}
                            className="w-full text-center text-xs font-black font-mono text-slate-800 focus:outline-none"
                          />
                          <button
                            onClick={() => handleUpdatePrice('container', opt.id, opt.price + 0.5)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black w-8 h-8 flex items-center justify-center transition active:scale-95"
                            title="زائد 0.5 ريال"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs font-bold text-slate-400">ر.س</span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-200">
                        <span className="text-xs font-bold text-slate-550">حالة التوفر:</span>
                        <button
                          onClick={() => handleToggleAvailability('container', opt.id, opt.isAvailable !== false)}
                          className={`px-3 py-1 rounded-xl text-[10px] font-black transition cursor-pointer flex items-center gap-1 border ${
                            opt.isAvailable !== false
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                              : 'bg-rose-50 border-rose-200 text-rose-600'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${opt.isAvailable !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {opt.isAvailable !== false ? 'متوفر' : 'غير متوفر ❌'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CATEGORY 2: FLAVORS */}
              <div className="bg-white rounded-3xl p-6 border-4 border-slate-800 shadow-[8px_8px_0px_rgba(30,41,59,0.1)] space-y-4">
                <h3 className="font-black text-slate-800 text-sm border-r-4 border-pink-500 pr-2 pb-1 flex items-center justify-between">
                  <span>2. نكهات كرات الآيس كريم</span>
                  <span className="text-xs text-slate-400 font-bold">({flavors.length} نكهات)</span>
                </h3>
                <div className="space-y-4">
                  {flavors.map((flavor) => (
                    <div key={flavor.id} className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-200 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl select-none">{flavor.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-black text-slate-800 truncate">{flavor.name}</h4>
                          <span className="text-[10px] text-slate-400 font-bold block">{flavor.nameEn}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 shrink-0">السعر الإضافي:</span>
                        <div className="flex items-center bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-inner flex-1">
                          <button
                            onClick={() => handleUpdatePrice('flavor', flavor.id, Math.max(0, flavor.price - 0.5))}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black w-8 h-8 flex items-center justify-center transition active:scale-95"
                            title="ناقص 0.5 ريال"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={flavor.price}
                            onChange={(e) => handleUpdatePrice('flavor', flavor.id, parseFloat(e.target.value) || 0)}
                            className="w-full text-center text-xs font-black font-mono text-slate-800 focus:outline-none"
                          />
                          <button
                            onClick={() => handleUpdatePrice('flavor', flavor.id, flavor.price + 0.5)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black w-8 h-8 flex items-center justify-center transition active:scale-95"
                            title="زائد 0.5 ريال"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs font-bold text-slate-400">ر.س</span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-200">
                        <span className="text-xs font-bold text-slate-550">حالة التوفر:</span>
                        <button
                          onClick={() => handleToggleAvailability('flavor', flavor.id, flavor.isAvailable !== false)}
                          className={`px-3 py-1 rounded-xl text-[10px] font-black transition cursor-pointer flex items-center gap-1 border ${
                            flavor.isAvailable !== false
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                              : 'bg-rose-50 border-rose-200 text-rose-600'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${flavor.isAvailable !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {flavor.isAvailable !== false ? 'متوفر' : 'غير متوفر ❌'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CATEGORY 3: TOPPINGS */}
              <div className="bg-white rounded-3xl p-6 border-4 border-slate-800 shadow-[8px_8px_0px_rgba(30,41,59,0.1)] space-y-4">
                <h3 className="font-black text-slate-800 text-sm border-r-4 border-pink-500 pr-2 pb-1 flex items-center justify-between">
                  <span>3. إضافات الزينة والصلصات</span>
                  <span className="text-xs text-slate-400 font-bold">({toppings.length} إضافات)</span>
                </h3>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {toppings.map((topping) => (
                    <div key={topping.id} className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-200 space-y-3 font-sans">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl select-none">{topping.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-black text-slate-800 truncate">{topping.name}</h4>
                          <span className="text-[10px] text-slate-400 font-bold block">{topping.nameEn} • {topping.category === 'solid' ? 'جامد' : topping.category === 'sauce' ? 'وافل وصوص' : 'فواكه'}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 shrink-0">السعر:</span>
                        <div className="flex items-center bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-inner flex-1">
                          <button
                            onClick={() => handleUpdatePrice('topping', topping.id, Math.max(0, topping.price - 0.5))}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black w-8 h-8 flex items-center justify-center transition active:scale-95"
                            title="ناقص 0.5 ريال"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={topping.price}
                            onChange={(e) => handleUpdatePrice('topping', topping.id, parseFloat(e.target.value) || 0)}
                            className="w-full text-center text-xs font-black font-mono text-slate-800 focus:outline-none"
                          />
                          <button
                            onClick={() => handleUpdatePrice('topping', topping.id, topping.price + 0.5)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black w-8 h-8 flex items-center justify-center transition active:scale-95"
                            title="زائد 0.5 ريال"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs font-bold text-slate-400">ر.س</span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-200">
                        <span className="text-xs font-bold text-slate-550">حالة التوفر:</span>
                        <button
                          onClick={() => handleToggleAvailability('topping', topping.id, topping.isAvailable !== false)}
                          className={`px-3 py-1 rounded-xl text-[10px] font-black transition cursor-pointer flex items-center gap-1 border ${
                            topping.isAvailable !== false
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                              : 'bg-rose-50 border-rose-200 text-rose-600'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${topping.isAvailable !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {topping.isAvailable !== false ? 'متوفر' : 'غير متوفر ❌'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}
      </main>

      {/* --- POS THERMAL RECEIPT MODAL (فاتورة مبيعات لمحاكاة حرارية قابلة للطباعة) --- */}
      <AnimatePresence>
        {completedOrder && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border-4 border-slate-850 overflow-hidden relative"
              dir="rtl"
            >
              
              <div id="receipt-content" className="bg-white p-1">
                {/* Receipt Header styling */}
                <div className="text-center pb-4 border-b-2 border-dashed border-slate-350">
                  <span className="text-4xl">🍦</span>
                  <h3 className="font-black text-slate-850 text-base mt-2">محل آيس كريم العائلة الفاخر</h3>
                  <p className="text-[10px] text-slate-400 font-bold">فرع الحلويات والبيع السريع - POS</p>
                  <p className="text-[9px] text-slate-400 mt-1 flex items-center justify-center gap-1 font-mono font-bold">
                    <Clock className="w-2.5 h-2.5 text-pink-500" />
                    <span>تاريخ الشراء: {completedOrder.timestamp}</span>
                  </p>
                  {completedOrder.customerName && (
                    <div className="mt-2 text-center text-[11px] font-black text-slate-800 bg-pink-50/50 py-1 px-3 rounded-lg border border-pink-100">
                      <span>العميل: </span>
                      <span>{completedOrder.customerName}</span>
                    </div>
                  )}
                </div>

                {/* Receipt Body items list */}
                <div className="py-4 space-y-3 font-mono text-[11px] text-slate-705">
                  <div className="flex justify-between font-black text-slate-400 pb-1 border-b border-slate-200">
                    <span>الصنف والنوع</span>
                    <span>المجموع</span>
                  </div>

                  {completedOrder.items.map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between font-black text-slate-900">
                        <span>{item.container.name} ×{item.quantity}</span>
                        <span>{item.itemTotal.toFixed(2)} ريال</span>
                      </div>
                      {/* Flavors underlay */}
                      <div className="text-[10px] text-slate-500 font-bold">
                        نكهات: {item.flavors.map(f => f.name).join('، ')}
                      </div>
                      {/* Toppings underlay */}
                      {item.toppings.length > 0 && (
                        <div className="text-[10px] text-emerald-600 font-bold">
                          إضافات: {item.toppings.map(t => t.name).join(' + ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Receipt footer pricing and breakdown */}
                <div className="pt-4 border-t-2 border-dashed border-slate-350 font-mono text-[11px] space-y-1.5 text-slate-600">
                  <div className="flex justify-between font-bold">
                    <span>المجموع الفرعي للآيس كريم:</span>
                    <span>{completedOrder.subtotal.toFixed(2)} ريال</span>
                  </div>
                  {completedOrder.toppingsTotal > 0 && (
                    <div className="flex justify-between font-bold">
                      <span>إجمالي تكلفة الإضافات الحصرية:</span>
                      <span>+{completedOrder.toppingsTotal.toFixed(2)} ريال</span>
                    </div>
                  )}
                  {completedOrder.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-black">
                      <span>قيمة التخفيضات المقتطعة:</span>
                      <span>-{completedOrder.discountAmount.toFixed(2)} ريال</span>
                    </div>
                  )}
                  
                  {/* Applied details */}
                  <p className="text-[9px] text-emerald-700 py-1 px-1.5 bg-emerald-50 rounded font-bold border border-emerald-100">
                    العروض والخصومات: {completedOrder.calculatedDiscountName}
                  </p>

                  <div className="flex justify-between text-xs text-slate-900 font-black pt-2 border-t border-slate-200 text-sm">
                    <span>الحساب الإجمالي المقبوض:</span>
                    <span className="text-pink-650 font-black">{completedOrder.total.toFixed(2)} ريال</span>
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-500 pt-1 font-bold">
                    <span>طريقة الدفع في الوعاء:</span>
                    <span>
                      {completedOrder.paymentMethod === 'cash'
                        ? 'نقداً / كاش'
                        : `تحويل بنكي (${
                            completedOrder.bankSubMethod === 'stc'
                              ? 'STC Pay'
                              : completedOrder.bankSubMethod === 'barq'
                              ? 'barq'
                              : completedOrder.bankSubMethod === 'urpay'
                              ? 'urpay'
                              : completedOrder.bankSubMethod === 'other'
                              ? 'بنك آخر'
                              : 'تحويل بنكي'
                          })`}
                    </span>
                  </div>

                  {completedOrder.paymentMethod === 'cash' && (
                    <>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono font-bold">
                        <span>المستلم من العميل:</span>
                        <span>{(completedOrder.receivedAmount || 0).toFixed(2)} ريال</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-bold font-mono">
                        <span>المرتجع للعميل (الباقي):</span>
                        <span>{(completedOrder.changeAmount || 0).toFixed(2)} ريال</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* WhatsApp invoice sharing */}
              <div className="mt-6 flex gap-2">
                <a
                  href={getWhatsAppUrl(completedOrder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/15 cursor-pointer text-center"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>إرسال بالواتساب</span>
                </a>
                <button
                  onClick={() => setCompletedOrder(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-750 font-black text-xs py-3 rounded-xl transition text-center cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>

              {/* Thermal bottom decorative teeth */}
              <div className="absolute bottom-0 inset-x-0 h-1.5 flex overflow-hidden">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="w-4 h-4 bg-slate-100 rotate-45 shrink-0 -mb-2 border-t border-l border-slate-200" />
                ))}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- FOOTER STATEMENT (تذييل التطبيق) --- */}
      <footer className="mt-16 text-center text-xs text-slate-400 select-none pb-8">
        <p className="font-extrabold text-pink-400 tracking-wide">جميع مبيعات ومكونات الآيس كريم مسعرة بالريال السعودي (ر.س)</p>
        <p className="mt-1.5 opacity-75 font-bold">بنيت واجهة نقاط البيع بحب ودقة لمبيعات مبهجة • سحر الآيس كريم 🍦 2026</p>
      </footer>

    </div>
  );
}
