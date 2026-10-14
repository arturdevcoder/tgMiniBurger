import { useEffect, useState, useCallback, useRef } from "react";
import { PRODUCTS, CATEGORIES, formatPrice } from "./data.js";

const tg = window.Telegram?.WebApp;

const API_BASE = "https://api.tg.kbadk.ru";

const getWsUrl = () => {
  // Автоматически сформирует wss://api.tg.kbadk.ru/ws
  return "wss://api.tg.kbadk.ru/ws";
};

export default function App() {
  // ======= STATE =======
  const [cart, setCart] = useState([]);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedToppings, setSelectedToppings] = useState(new Set());
  const [activeCategory, setActiveCategory] = useState("burgers");
  const [favorites, setFavorites] = useState(new Set());

  const [editingCartItemId, setEditingCartItemId] = useState(null);

  // Screens & modals
  const [showDetails, setShowDetails] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showOrderTracking, setShowOrderTracking] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Checkout form state
  const [customerName, setCustomerName] = useState(() => {
    const user = tg?.initDataUnsafe?.user;
    if (user?.first_name) {
      return `${user.first_name} ${user.last_name || ""}`.trim();
    }
    return "";
  });
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerComment, setCustomerComment] = useState("");
  const [formError, setFormError] = useState("");

  // Active Order state
  const [activeOrder, setActiveOrder] = useState(null);

  // Initialize Telegram
  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      try {
        if (typeof tg.requestFullscreen === "function") {
          tg.requestFullscreen();
        }
        if (typeof tg.disableVerticalSwipes === "function") {
          tg.disableVerticalSwipes();
        }
      } catch (err) {
        console.error("TG fullscreen error:", err);
      }
    }
  }, []);

  // Restore active order from localStorage if exists
  useEffect(() => {
    const savedOrderId = localStorage.getItem("activeOrderId");
    if (savedOrderId) {
      fetch(`${API_BASE}/api/orders/${savedOrderId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.order) {
            setActiveOrder(data.order);
            if (data.order.status === "pending" || data.order.status === "accepted") {
              setShowOrderTracking(true);
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  // Real-time updates for activeOrder via WebSocket and Polling fallback
  useEffect(() => {
    if (!activeOrder || (activeOrder.status !== "pending" && activeOrder.status !== "accepted")) return;

    let ws = null;
    let isMounted = true;

    const connectWs = () => {
      try {
        const wsUrl = getWsUrl();
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "subscribe_order", orderId: activeOrder.id }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "order_status_changed" && data.order && data.order.id === activeOrder.id) {
              if (isMounted) {
                setActiveOrder(data.order);
                if (data.order.status === "accepted") {
                  tg?.HapticFeedback?.notificationOccurred("success");
                } else if (data.order.status === "rejected") {
                  tg?.HapticFeedback?.notificationOccurred("error");
                }
              }
            }
          } catch (e) {}
        };
      } catch (e) {}
    };

    connectWs();

    // Polling fallback every 3s
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/orders/${activeOrder.id}`);
        const data = await res.json();
        if (data.success && data.order && isMounted) {
          if (data.order.status !== activeOrder.status || data.order.estimatedMinutes !== activeOrder.estimatedMinutes) {
            setActiveOrder(data.order);
            if (data.order.status === "accepted") {
              tg?.HapticFeedback?.notificationOccurred("success");
            }
          }
        }
      } catch (e) {}
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (ws) ws.close();
    };
  }, [activeOrder?.id, activeOrder?.status]);

  // ======= PRODUCT DETAILS =======
  const openDetails = useCallback((productId) => {
    const product = PRODUCTS.find((p) => p.id === productId);
    setCurrentProduct(product);
    setSelectedSize(product.sizes[0]);
    setSelectedToppings(new Set());
    setEditingCartItemId(null);
    setShowDetails(true);
  }, []);

  const editCartItem = useCallback((cartItem) => {
    const product = PRODUCTS.find((p) => p.id === cartItem.productId);
    if (!product) return;
    setCurrentProduct(product);
    const sizeObj = product.sizes.find((s) => s.id === cartItem.sizeId) || product.sizes[0];
    setSelectedSize(sizeObj);
    setSelectedToppings(new Set(cartItem.toppingIds || []));
    setEditingCartItemId(cartItem.id);
    setShowCart(false);
    setShowDetails(true);
  }, []);

  const closeDetails = useCallback(() => {
    setShowDetails(false);
    if (editingCartItemId) {
      setShowCart(true);
      setEditingCartItemId(null);
    }
  }, [editingCartItemId]);

  const selectSize = useCallback((sizeId) => {
    if (!currentProduct) return;
    setSelectedSize(currentProduct.sizes.find((s) => s.id === sizeId));
  }, [currentProduct]);

  const toggleTopping = useCallback((toppingId) => {
    setSelectedToppings((prev) => {
      const next = new Set(prev);
      if (next.has(toppingId)) {
        next.delete(toppingId);
      } else {
        next.add(toppingId);
      }
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((productId) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
    tg?.HapticFeedback?.impactOccurred("light");
  }, []);

  const getDetailPrice = () => {
    if (!currentProduct || !selectedSize) return 0;
    let total = currentProduct.basePrice + selectedSize.price;
    selectedToppings.forEach((id) => {
      const t = currentProduct.toppings.find((x) => x.id === id);
      if (t) total += t.price;
    });
    return total;
  };

  // ======= CART =======
  const addToCart = useCallback(() => {
    if (!currentProduct || !selectedSize) return;
    let itemPrice = currentProduct.basePrice + selectedSize.price;
    const toppingIds = Array.from(selectedToppings);
    toppingIds.forEach((id) => {
      const t = currentProduct.toppings.find((x) => x.id === id);
      if (t) {
        itemPrice += t.price;
      }
    });

    if (editingCartItemId) {
      setCart((prev) =>
        prev.map((item) => {
          if (item.id === editingCartItemId) {
            return {
              ...item,
              size: selectedSize.name,
              sizeId: selectedSize.id,
              toppingIds,
              price: itemPrice,
            };
          }
          return item;
        })
      );
      tg?.HapticFeedback?.impactOccurred("medium");
      setShowDetails(false);
      setShowCart(true);
      setEditingCartItemId(null);
      return;
    }

    const cartItem = {
      id: Date.now(),
      productId: currentProduct.id,
      name: currentProduct.name,
      img: currentProduct.img,
      size: selectedSize.name,
      sizeId: selectedSize.id,
      toppingIds,
      price: itemPrice,
      qty: 1,
    };

    setCart((prev) => [...prev, cartItem]);
    tg?.HapticFeedback?.impactOccurred("light");
    closeDetails();
  }, [currentProduct, selectedSize, selectedToppings, editingCartItemId, closeDetails]);

  const removeToppingFromCartItem = useCallback((cartItemId, toppingId) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== cartItemId) return item;
        const product = PRODUCTS.find((p) => p.id === item.productId);
        const toppingObj = product?.toppings.find((t) => t.id === toppingId);
        const toppingPrice = toppingObj?.price || 0;
        const nextToppings = (item.toppingIds || []).filter((id) => id !== toppingId);
        return {
          ...item,
          toppingIds: nextToppings,
          price: Math.max(0, item.price - toppingPrice),
        };
      })
    );
    tg?.HapticFeedback?.impactOccurred("light");
  }, []);

  const removeFromCart = useCallback((itemId) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  const openCart = useCallback(() => setShowCart(true), []);
  const closeCart = useCallback(() => setShowCart(false), []);

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  // Submit order to Elysia backend
  const handleStartCheckout = () => {
    setFormError("");
    setShowCheckoutModal(true);
  };

  const submitOrder = async () => {
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      setFormError("Пожалуйста, заполните имя, телефон и адрес доставки");
      tg?.HapticFeedback?.notificationOccurred("error");
      return;
    }

    setFormError("");
    setCheckoutLoading(true);

    try {
      // Prepare detailed items
      const itemsPayload = cart.map((c) => {
        const prod = PRODUCTS.find((p) => p.id === c.productId);
        const toppingNames = (c.toppingIds || [])
          .map((tid) => prod?.toppings?.find((t) => t.id === tid)?.name)
          .filter(Boolean)
          .join(", ");

        return {
          name: c.name,
          size: c.size,
          toppings: toppingNames,
          price: c.price,
          qty: c.qty || 1,
          img: c.img,
        };
      });

      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress: customerAddress.trim(),
          customerComment: customerComment.trim() || undefined,
          items: itemsPayload,
          totalAmount: cartTotal,
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        setCart([]);
        setActiveOrder(data.order);
        localStorage.setItem("activeOrderId", String(data.order.id));
        setShowCart(false);
        setShowCheckoutModal(false);
        setShowOrderTracking(true);
        tg?.HapticFeedback?.notificationOccurred("success");
      } else {
        setFormError(data.error || "Не удалось отправить заказ");
        tg?.HapticFeedback?.notificationOccurred("error");
      }
    } catch (err) {
      setFormError("Ошибка подключения к серверу");
      tg?.HapticFeedback?.notificationOccurred("error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const filteredProducts = PRODUCTS.filter(
    (p) => p.category === activeCategory
  );

  // ======= RENDER =======
  return (
    <div
      id="app"
      className="w-full max-w-md mx-auto relative bg-[#F8F9FA] h-[100dvh] overflow-hidden flex flex-col font-sans"
    >
      {/* ==================== SCREEN 1: HOME ==================== */}
      <div
        id="home-screen"
        className={`screen ${showDetails || showCart || showOrderTracking ? "" : "screen-active"} absolute inset-0 z-10 overflow-y-auto pb-32 no-scrollbar`}
      >
        {/* Header with safe area top padding for TG buttons */}
        <header
          className="px-6 pb-2"
          style={{
            paddingTop: "max(1rem, calc(var(--tg-safe-top) + 0.5rem))",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Dark rounded icon box */}
              <div className="w-12 h-12 bg-gray-950 rounded-2xl flex items-center justify-center shadow-md shadow-black/10 shrink-0">
                <span className="text-2xl leading-none select-none">🍔</span>
              </div>
              {/* Brand text */}
              <div className="flex flex-col">
                <span className="text-xl font-black text-gray-900 tracking-wider leading-none">
                  YUMMY
                </span>
                <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mt-1">
                  доставка еды
                </span>
              </div>
            </div>

            {/* If active order exists, show a floating status button */}
            {activeOrder && (activeOrder.status === "pending" || activeOrder.status === "accepted") && (
              <button
                type="button"
                onClick={() => setShowOrderTracking(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition shadow-sm active:scale-95 ${
                  activeOrder.status === "accepted"
                    ? "bg-green-500 text-white animate-pulse"
                    : "bg-amber-100 text-amber-800 border border-amber-300"
                }`}
              >
                <span>{activeOrder.status === "accepted" ? "🛵" : "⏳"}</span>
                <span>{activeOrder.status === "accepted" ? "Принят" : "Ждет..."}</span>
              </button>
            )}
          </div>
        </header>

        {/* Greeting */}
        <div className="px-6 pt-3 pb-5">
          <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">
            Что будем <br />
            <span className="text-brand">есть сегодня?</span> 🤤
          </h1>
        </div>

        {/* Categories */}
        <div className="flex overflow-x-auto gap-3.5 px-6 mb-8 no-scrollbar touch-pan-x scroll-smooth -mx-1 px-7">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex flex-col items-center justify-center shrink-0 w-[74px] h-[92px] rounded-[24px] active:scale-95 transition transform ${
                activeCategory === cat.id
                  ? "bg-brand text-white shadow-brand"
                  : "bg-white text-gray-600 shadow-soft"
              }`}
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center mb-1 text-2xl ${
                  activeCategory === cat.id ? "bg-white/20" : "bg-gray-50"
                }`}
              >
                {cat.icon}
              </div>
              <span className="text-xs font-semibold">{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Products */}
        <div className="px-6 mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {CATEGORIES.find((c) => c.id === activeCategory)?.name || "Популярное"}
          </h2>
          {filteredProducts.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center opacity-60">
              <span className="text-5xl mb-3">🍽️</span>
              <p className="text-sm text-gray-500 font-medium">В этой категории пока нет блюд</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredProducts.map((product, index) => {
                const catLabel = CATEGORIES.find((c) => c.id === product.category)?.name || "";
                const isFav = favorites.has(product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => openDetails(product.id)}
                    className={`bg-white rounded-[20px] overflow-hidden shadow-soft cursor-pointer active:scale-[0.97] transition transform opacity-0 animate-pop-in delay-${(index + 1) * 100}`}
                  >
                    {/* Image */}
                    <div className="relative w-full h-36 bg-gray-50">
                      <img
                        src={product.img}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                      {/* Heart */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(product.id);
                        }}
                        className="absolute top-2.5 right-2.5 w-8 h-8 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md active:scale-90 transition"
                        aria-label="В избранное"
                      >
                        {isFav ? (
                          <i className="fa-solid fa-heart text-red-500 text-sm"></i>
                        ) : (
                          <i className="fa-regular fa-heart text-gray-700 text-sm"></i>
                        )}
                      </button>
                    </div>

                    {/* Info */}
                    <div className="p-3.5">
                      <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1">
                        {product.name}
                      </h3>
                      <p className="text-[11px] text-gray-400 mb-3">
                        {catLabel} · {product.time}-{product.time + 10} мин
                      </p>
                      <div className="flex justify-between items-end">
                        <div>
                          <span className="font-extrabold text-gray-900 text-base">
                            {product.basePrice} ₽
                          </span>
                          <p className="text-[10px] text-gray-400 mt-0.5">от цены</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetails(product.id);
                          }}
                          className="w-10 h-10 bg-brand text-white rounded-2xl flex items-center justify-center shadow-brand active:scale-90 transition"
                          aria-label="Открыть товар"
                        >
                          <i className="fa-solid fa-plus text-base"></i>
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

      {/* ==================== SCREEN 2: PRODUCT DETAILS ==================== */}
      <div
        id="details-screen"
        className={`screen ${showDetails ? "screen-active" : "screen-hidden-right"} absolute inset-0 z-30 bg-white flex flex-col`}
      >
        {/* Details Header */}
        <div
          className="absolute top-0 left-0 w-full px-6 flex justify-between items-center z-40"
          style={{
            paddingTop: "max(1.25rem, calc(var(--tg-safe-top) + 0.5rem))",
          }}
        >
          <button
            onClick={closeDetails}
            className="w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm active:scale-90 transition"
          >
            <i className="fa-solid fa-arrow-left text-gray-800"></i>
          </button>
          <button
            type="button"
            onClick={() => currentProduct && toggleFavorite(currentProduct.id)}
            className="w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm active:scale-90 transition"
            aria-label="В избранное"
          >
            <i
              className={`fa-solid fa-heart transition-colors duration-200 ${
                currentProduct && favorites.has(currentProduct.id)
                  ? "text-red-500"
                  : "text-gray-300 hover:text-red-400"
              }`}
            ></i>
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
          {/* Image */}
          <div className="relative w-full h-[45%] bg-brand-light flex items-center justify-center rounded-b-[40px] pt-10">
            {currentProduct && (
              <img
                src={currentProduct.img}
                alt={currentProduct.name}
                className="w-64 h-64 object-contain animate-float drop-shadow-2xl mix-blend-multiply"
              />
            )}
          </div>

          <div className="px-6 pt-6">
            <div className="flex justify-between items-start mb-2">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight w-2/3">
                {currentProduct?.name}
              </h1>
              <div className="flex items-center bg-brand text-white px-2 py-1 rounded-lg text-sm font-bold shadow-sm">
                <i className="fa-solid fa-star text-[10px] mr-1"></i>
                {currentProduct?.rating}
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              {currentProduct?.desc}
            </p>

            {/* Size selection */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-gray-900">Размер / Порция</h3>
              </div>
              <div className="flex gap-3">
                {currentProduct?.sizes.map((size) => {
                  const isActive = selectedSize?.id === size.id;
                  return (
                    <button
                      key={size.id}
                      onClick={() => selectSize(size.id)}
                      className={`flex-1 py-3 border-2 rounded-2xl font-semibold text-sm transition active:scale-95 ${
                        isActive
                          ? "bg-brand text-white border-brand shadow-brand"
                          : "bg-white text-gray-600 border-gray-200"
                      }`}
                    >
                      {size.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toppings */}
            {currentProduct?.toppings && currentProduct.toppings.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-900 mb-3">
                  Добавить топпинги
                </h3>
                <div className="flex flex-wrap gap-3">
                  {currentProduct.toppings.map((top) => {
                    const isActive = selectedToppings.has(top.id);
                    return (
                      <div
                        key={top.id}
                        onClick={() => toggleTopping(top.id)}
                        className={`relative border-2 rounded-xl p-3 flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition w-[calc(33.333%-0.5rem)] ${
                          isActive
                            ? "border-brand bg-brand-light text-brand"
                            : "border-gray-200 bg-white text-gray-700"
                        }`}
                      >
                        {isActive && (
                          <i className="fa-solid fa-circle-check absolute top-1.5 right-1.5 text-brand"></i>
                        )}
                        <span className="text-2xl">{top.icon}</span>
                        <span className="text-xs font-semibold mt-1">
                          {top.name}
                        </span>
                        <span className="text-[10px] opacity-80">
                          +{top.price}₽
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Details Footer (Fixed) */}
        <div
          className="absolute bottom-0 left-0 w-full bg-white px-6 pt-5 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] rounded-t-[30px] z-40 flex items-center justify-between"
          style={{
            paddingBottom: "max(1.5rem, calc(var(--tg-safe-bottom) + 0.75rem))",
          }}
        >
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 mb-1">Итоговая цена</span>
            <span className="text-2xl font-black text-gray-900">
              {formatPrice(getDetailPrice())}
            </span>
          </div>
          <button
            onClick={addToCart}
            className="bg-gray-900 text-white px-8 py-4 rounded-[20px] font-semibold flex items-center gap-2 active:scale-95 transition shadow-lg"
          >
            <span>{editingCartItemId ? "Сохранить" : "В корзину"}</span>
            <i className={`fa-solid ${editingCartItemId ? "fa-check" : "fa-bag-shopping"} text-sm`}></i>
          </button>
        </div>
      </div>

      {/* ==================== SCREEN 3: CART ==================== */}
      <div
        id="cart-screen"
        className={`screen ${showCart ? "screen-active" : "screen-hidden-bottom"} absolute inset-0 z-50 bg-[#F8F9FA] flex flex-col`}
      >
        <div
          className="px-6 pb-4 bg-white flex justify-between items-center shadow-sm z-10"
          style={{
            paddingTop: "max(1.25rem, calc(var(--tg-safe-top) + 0.5rem))",
          }}
        >
          <h2 className="text-xl font-bold text-gray-900">Корзина</h2>
          <button
            onClick={closeCart}
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center active:scale-90 transition"
          >
            <i className="fa-solid fa-xmark text-gray-800"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pb-28 no-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
              <i className="fa-solid fa-basket-shopping text-6xl mb-4 text-gray-300"></i>
              <p className="text-gray-500 font-medium">Ваша корзина пуста</p>
            </div>
          ) : (
            cart.map((item, index) => {
              const product = PRODUCTS.find((p) => p.id === item.productId);
              const toppingItems = (item.toppingIds || [])
                .map((tid) => product?.toppings?.find((t) => t.id === tid))
                .filter(Boolean);

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl p-3.5 shadow-sm mb-4 opacity-0 animate-pop-in delay-${(index + 1) * 100} relative`}
                >
                  <div className="flex gap-3">
                    <div className="w-20 h-20 bg-gray-50 rounded-xl flex items-center justify-center p-1 shrink-0 overflow-hidden">
                      <img
                        src={item.img}
                        alt={item.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                    <div className="flex-1 pr-6">
                      <h4 className="font-bold text-gray-900 text-sm leading-tight">
                        {item.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Размер: {item.size}
                      </p>

                      <div className="font-black text-brand text-base mt-1.5">
                        {formatPrice(item.price)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="absolute top-3.5 right-3.5 text-gray-300 hover:text-red-500 transition active:scale-90"
                      aria-label="Удалить"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>

                  {/* Toppings section */}
                  {toppingItems.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500">
                          Добавки ({toppingItems.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => editCartItem(item)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-dark active:scale-95 transition"
                        >
                          <i className="fa-solid fa-sliders text-xs"></i>
                          <span>Настроить</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {toppingItems.map((top) => (
                          <div
                            key={top.id}
                            className="inline-flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200/80 rounded-xl px-2.5 py-1.5 text-xs font-medium text-gray-800 transition"
                          >
                            <span className="text-sm">{top.icon}</span>
                            <span>{top.name}</span>
                            <button
                              type="button"
                              onClick={() => removeToppingFromCartItem(item.id, top.id)}
                              className="w-4 h-4 rounded-full bg-gray-200 hover:bg-red-500 hover:text-white text-gray-500 flex items-center justify-center ml-0.5 transition active:scale-90"
                              title={`Убрать ${top.name}`}
                              aria-label={`Убрать топинг ${top.name}`}
                            >
                              <i className="fa-solid fa-xmark text-[9px]"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {toppingItems.length === 0 && (
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-400">Без добавок</span>
                      <button
                        type="button"
                        onClick={() => editCartItem(item)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-dark active:scale-95 transition"
                      >
                        <i className="fa-solid fa-plus text-xs"></i>
                        <span>Добавить топинги</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Cart Footer */}
        {cart.length > 0 && (
          <div
            className="bg-white px-6 pt-5 rounded-t-[30px] shadow-[0_-10px_40px_rgba(0,0,0,0.08)]"
            style={{
              paddingBottom: "max(1.5rem, calc(var(--tg-safe-bottom) + 0.75rem))",
            }}
          >
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Сумма заказов</span>
                <span className="font-medium text-gray-900">
                  {formatPrice(cartTotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Доставка</span>
                <span className="font-medium text-green-500">Бесплатно</span>
              </div>
              <div className="h-px w-full bg-gray-100 my-2"></div>
              <div className="flex justify-between items-end">
                <span className="text-gray-900 font-bold">К оплате</span>
                <span className="text-2xl font-black text-brand">
                  {formatPrice(cartTotal)}
                </span>
              </div>
            </div>
            <button
              onClick={handleStartCheckout}
              className="w-full bg-brand text-white py-4 rounded-[20px] font-bold text-lg active:scale-95 transition shadow-brand"
            >
              Оформить заказ
            </button>
          </div>
        )}
      </div>

      {/* ==================== SCREEN 4: CHECKOUT FORM MODAL ==================== */}
      <div
        className={`screen ${showCheckoutModal ? "screen-active" : "screen-hidden-bottom"} absolute inset-0 z-50 bg-[#F8F9FA] flex flex-col`}
      >
        <div
          className="px-6 pb-4 bg-white flex justify-between items-center shadow-sm z-10"
          style={{
            paddingTop: "max(1.25rem, calc(var(--tg-safe-top) + 0.5rem))",
          }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCheckoutModal(false)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 active:scale-90 transition mr-1"
            >
              <i className="fa-solid fa-arrow-left text-sm"></i>
            </button>
            <h2 className="text-xl font-bold text-gray-900">Данные доставки</h2>
          </div>
          <button
            onClick={() => setShowCheckoutModal(false)}
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center active:scale-90 transition"
          >
            <i className="fa-solid fa-xmark text-gray-800"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pb-28 no-scrollbar">
          <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                Ваше имя *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Как к вам обращаться"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-sm text-gray-900 focus:outline-none focus:border-brand focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                Телефон *
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+7 (999) 000-00-00"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-sm text-gray-900 focus:outline-none focus:border-brand focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                Адрес доставки *
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Улица, дом, подъезд, квартира"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-sm text-gray-900 focus:outline-none focus:border-brand focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                Комментарий курьеру
              </label>
              <textarea
                value={customerComment}
                onChange={(e) => setCustomerComment(e.target.value)}
                placeholder="Код домофона, этаж, пожелания..."
                rows={2}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-brand focus:bg-white transition resize-none"
              ></textarea>
            </div>
          </div>

          {formError && (
            <div className="bg-red-50 text-red-600 border border-red-200 rounded-2xl px-4 py-3 text-xs font-semibold mb-4 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-sm shrink-0"></i>
              <span>{formError}</span>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-amber-900 text-xs">
            <div className="flex items-center gap-2 font-bold mb-1">
              <i className="fa-solid fa-bell text-amber-600"></i>
              <span>Подтверждение администратора</span>
            </div>
            <p className="text-amber-800/90 leading-relaxed">
              После отправки заказ поступит администратору. Вы сразу увидите статус подтверждения прямо в приложении!
            </p>
          </div>
        </div>

        {/* Checkout Modal Footer */}
        <div
          className="bg-white px-6 pt-4 rounded-t-[30px] shadow-[0_-10px_40px_rgba(0,0,0,0.08)]"
          style={{
            paddingBottom: "max(1.5rem, calc(var(--tg-safe-bottom) + 0.75rem))",
          }}
        >
          <div className="flex justify-between items-center mb-3 text-sm">
            <span className="text-gray-500">К оплате при получении:</span>
            <span className="text-xl font-black text-brand">{formatPrice(cartTotal)}</span>
          </div>
          <button
            onClick={submitOrder}
            disabled={checkoutLoading}
            className="w-full bg-brand hover:bg-brand-dark text-white py-4 rounded-[20px] font-bold text-lg active:scale-95 transition shadow-brand flex items-center justify-center gap-2"
          >
            {checkoutLoading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Отправка заказа...</span>
              </>
            ) : (
              <>
                <span>Отправить заказ</span>
                <i className="fa-solid fa-paper-plane text-sm"></i>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ==================== SCREEN 5: ORDER TRACKING SCREEN ==================== */}
      <div
        className={`screen ${showOrderTracking ? "screen-active" : "screen-hidden-bottom"} absolute inset-0 z-50 bg-[#F8F9FA] flex flex-col`}
      >
        <div
          className="px-6 pb-4 bg-white flex justify-between items-center shadow-sm z-10"
          style={{
            paddingTop: "max(1.25rem, calc(var(--tg-safe-top) + 0.5rem))",
          }}
        >
          <h2 className="text-xl font-bold text-gray-900">
            Заказ #{activeOrder?.id || ""}
          </h2>
          <button
            onClick={() => setShowOrderTracking(false)}
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center active:scale-90 transition"
          >
            <i className="fa-solid fa-xmark text-gray-800"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pb-28 no-scrollbar">
          {activeOrder && (
            <div className="space-y-4">
              {/* Dynamic Status Banner */}
              {activeOrder.status === "pending" && (
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-3xl p-6 text-center shadow-lg relative overflow-hidden">
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md mx-auto flex items-center justify-center text-3xl mb-3 animate-bounce">
                    ⏳
                  </div>
                  <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                    Ожидает подтверждения
                  </span>
                  <h3 className="text-2xl font-black mb-2 leading-tight">
                    Заказ отправлен админу!
                  </h3>
                  <p className="text-xs text-amber-100 max-w-xs mx-auto leading-relaxed">
                    Администратор проверяет заказ и вот-вот подтвердит его. Страница обновится автоматически!
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold bg-black/10 py-2 rounded-xl">
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
                    <span>Связь с рестораном активна</span>
                  </div>
                </div>
              )}

              {activeOrder.status === "accepted" && (
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-3xl p-6 text-center shadow-lg relative overflow-hidden">
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md mx-auto flex items-center justify-center text-3xl mb-3 shadow-inner">
                    🎉
                  </div>
                  <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                    Заказ принят рестораном!
                  </span>
                  <h3 className="text-2xl font-black mb-1.5 leading-tight">
                    Заказ принят, ждите!
                  </h3>
                  <p className="text-sm font-semibold text-green-100">
                    Шеф-повар уже начал готовить ваши блюда
                  </p>

                  <div className="mt-4 bg-white/20 backdrop-blur-md rounded-2xl p-4 text-center">
                    <span className="text-xs uppercase tracking-wider text-green-100 block mb-0.5">
                      Примерное время доставки
                    </span>
                    <span className="text-3xl font-black text-white">
                      ~{activeOrder.estimatedMinutes || 25} минут
                    </span>
                  </div>
                </div>
              )}

              {activeOrder.status === "rejected" && (
                <div className="bg-gradient-to-br from-red-500 to-rose-600 text-white rounded-3xl p-6 text-center shadow-lg">
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md mx-auto flex items-center justify-center text-3xl mb-3">
                    ❌
                  </div>
                  <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                    Заказ отклонен
                  </span>
                  <h3 className="text-xl font-black mb-1 leading-tight">
                    Ресторан не смог принять заказ
                  </h3>
                  <p className="text-xs text-red-100 max-w-xs mx-auto mt-2">
                    Приносим извинения. Пожалуйста, попробуйте оформить заказ позже или выберите другие позиции.
                  </p>
                </div>
              )}

              {/* Progress Tracker */}
              <div className="bg-white rounded-3xl p-5 shadow-sm">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Этапы выполнения
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
                      <i className="fa-solid fa-check"></i>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Заказ отправлен</p>
                      <p className="text-[10px] text-gray-400">{activeOrder.createdAt}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        activeOrder.status === "accepted"
                          ? "bg-green-500 text-white shadow-sm"
                          : activeOrder.status === "pending"
                          ? "bg-amber-100 text-amber-700 animate-pulse border-2 border-amber-300"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {activeOrder.status === "accepted" ? (
                        <i className="fa-solid fa-check"></i>
                      ) : (
                        <i className="fa-solid fa-kitchen-set"></i>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">
                        {activeOrder.status === "accepted"
                          ? "Подтвержден и готовится"
                          : activeOrder.status === "rejected"
                          ? "Отклонен рестораном"
                          : "Ожидает подтверждения админа"}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {activeOrder.status === "accepted"
                          ? `Ориентировочно ~${activeOrder.estimatedMinutes || 25} мин`
                          : "В очереди на обработку"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs font-bold shrink-0">
                      <i className="fa-solid fa-motorcycle"></i>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500">Доставка курьером</p>
                      <p className="text-[10px] text-gray-400">Курьер привезет заказ по адресу</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery Details */}
              <div className="bg-white rounded-3xl p-5 shadow-sm space-y-2.5 text-xs">
                <h4 className="font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Детали доставки
                </h4>
                <div className="flex justify-between">
                  <span className="text-gray-400">Получатель:</span>
                  <span className="font-bold text-gray-800">{activeOrder.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Телефон:</span>
                  <span className="font-bold text-gray-800">{activeOrder.customerPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Адрес:</span>
                  <span className="font-bold text-gray-800 text-right max-w-[200px]">
                    {activeOrder.customerAddress}
                  </span>
                </div>
                {activeOrder.customerComment && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Комментарий:</span>
                    <span className="italic text-gray-600 text-right max-w-[200px]">
                      {activeOrder.customerComment}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t flex justify-between items-center text-sm font-black">
                  <span>Сумма заказа:</span>
                  <span className="text-brand text-base">{activeOrder.totalAmount} ₽</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-2">
                <button
                  onClick={() => setShowOrderTracking(false)}
                  className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-sm shadow-md active:scale-95 transition"
                >
                  Вернуться в меню
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== BOTTOM NAVIGATION ==================== */}
      <div
        id="bottom-nav"
        className={`absolute left-6 right-6 h-[70px] bg-gray-900 rounded-[24px] shadow-2xl flex justify-between items-center px-8 z-20 transition-transform duration-300 ${
          showDetails || showCart || showCheckoutModal || showOrderTracking
            ? "translate-y-[200%]"
            : "translate-y-0"
        }`}
        style={{
          bottom: "max(1.5rem, calc(var(--tg-safe-bottom) + 0.75rem))",
        }}
      >
        <button className="text-white flex flex-col items-center gap-1 active:scale-90 transition">
          <i className="fa-solid fa-house text-lg"></i>
          <div className="w-1 h-1 bg-brand rounded-full"></div>
        </button>
        <button className="text-gray-400 hover:text-white flex flex-col items-center gap-1 active:scale-90 transition">
          <i className="fa-regular fa-heart text-lg"></i>
        </button>

        {/* Cart Button */}
        <button
          onClick={openCart}
          className="relative -top-5 w-14 h-14 bg-brand rounded-full flex items-center justify-center shadow-brand active:scale-90 transition border-[6px] border-[#F8F9FA]"
        >
          <i className="fa-solid fa-bag-shopping text-white"></i>
          {cart.length > 0 && (
            <span className="absolute top-0 -right-1 bg-white text-brand text-[10px] font-extrabold w-5 h-5 flex items-center justify-center rounded-full shadow-md animate-badge">
              {cart.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            if (activeOrder) {
              setShowOrderTracking(true);
            }
          }}
          className={`flex flex-col items-center gap-1 active:scale-90 transition ${
            activeOrder ? "text-brand" : "text-gray-400 hover:text-white"
          }`}
          title="Статус заказа"
        >
          <i className="fa-solid fa-receipt text-lg"></i>
        </button>
        <button
          onClick={() => {
            window.open("/admin", "_blank");
          }}
          className="text-gray-400 hover:text-white flex flex-col items-center gap-1 active:scale-90 transition"
          title="Админ панель"
        >
          <i className="fa-solid fa-shield-halved text-lg"></i>
        </button>
      </div>
    </div>
  );
}
