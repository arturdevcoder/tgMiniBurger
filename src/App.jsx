import { useEffect, useMemo, useState } from "react";
import { BURGERS, formatPrice } from "./data.js";

const tg = window.Telegram?.WebApp;
const isInTelegram = Boolean(tg?.initData);

const EMPTY_FORM = { name: "", phone: "", address: "", comment: "" };

const TABS = [
  { id: "home", label: "Главная", icon: "🏠" },
  { id: "menu", label: "Меню", icon: "📋" },
  { id: "cart", label: "Корзина", icon: "🛒" },
  { id: "account", label: "Аккаунт", icon: "👤" },
];

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

function ProductCard({ item, qty, onAdd, onRemove }) {
  return (
    <div className="card">
      <div className="card-img" style={{ background: item.bg }}>
        {item.discount && <span className="badge">-{item.discount}%</span>}
        <span className="emoji">{item.emoji}</span>
      </div>
      <div className="price-row">
        <span className="price">{formatPrice(item.price)}</span>
        {item.oldPrice && <s className="old-price">{formatPrice(item.oldPrice)}</s>}
      </div>
      <div className="card-name">{item.name}</div>
      <div className="card-weight">{item.weight}</div>
      {qty === 0 ? (
        <button className="add-btn" onClick={onAdd}>В корзину</button>
      ) : (
        <div className="stepper">
          <button onClick={onRemove} aria-label="Убрать">−</button>
          <span>{qty}</span>
          <button onClick={onAdd} aria-label="Добавить">+</button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [cart, setCart] = useState({});
  const [tab, setTab] = useState("home");
  const [screen, setScreen] = useState("main"); // "main" | "checkout" | "done"
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    tg?.ready();
    tg?.expand();
  }, []);

  const items = useMemo(
    () => BURGERS.filter((b) => cart[b.id] > 0).map((b) => ({ ...b, qty: cart[b.id] })),
    [cart]
  );
  const totalCount = items.reduce((s, i) => s + i.qty, 0);
  const totalPrice = items.reduce((s, i) => s + i.qty * i.price, 0);

  const q = query.trim().toLowerCase();
  const matches = (b) => b.name.toLowerCase().includes(q);
  const dayDeals = BURGERS.filter((b) => b.discount && matches(b));
  const allItems = BURGERS.filter(matches);

  const add = (id) => {
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
    tg?.HapticFeedback?.impactOccurred("light");
  };
  const remove = (id) =>
    setCart((c) => {
      const next = { ...c, [id]: (c[id] || 0) - 1 };
      if (next[id] <= 0) delete next[id];
      return next;
    });

  const updateForm = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submitOrder = () => {
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError("Заполните имя, телефон и адрес доставки");
      tg?.HapticFeedback?.notificationOccurred("error");
      return;
    }
    setError("");
    const order = {
      items: items.map((i) => ({ id: i.id, qty: i.qty })),
      total: totalPrice,
      ...form,
    };
    if (isInTelegram) {
      tg.sendData(JSON.stringify(order)); // closes the Mini App and sends data to the bot
    } else {
      console.log("Заказ:", order);
      setCart({});
      setForm(EMPTY_FORM);
      setScreen("done");
    }
  };

  // Telegram BackButton on checkout
  useEffect(() => {
    if (!tg) return;
    const handler = () => setScreen("main");
    if (screen === "checkout") {
      tg.BackButton.onClick(handler);
      tg.BackButton.show();
    } else {
      tg.BackButton.hide();
    }
    return () => tg.BackButton.offClick(handler);
  });

  // Telegram MainButton
  useEffect(() => {
    if (!tg) return;
    const mb = tg.MainButton;
    let handler = null;
    let text = "";
    if (screen === "checkout") {
      handler = submitOrder;
      text = `Подтвердить · ${formatPrice(totalPrice)}`;
    } else if (screen === "main" && tab === "cart" && totalCount > 0) {
      handler = () => setScreen("checkout");
      text = `Оформить · ${formatPrice(totalPrice)}`;
    }
    if (handler) {
      mb.setText(text);
      mb.onClick(handler);
      mb.show();
      return () => mb.offClick(handler);
    }
    mb.hide();
  });

  const goToCheckout = () => setScreen("checkout");

  // ---------- Full screens ----------

  if (screen === "done") {
    return (
      <div className="page center">
        <div className="done-icon">✅</div>
        <h2>Заказ принят!</h2>
        <p className="muted">Мы скоро свяжемся с вами для подтверждения.</p>
        <button className="add-btn wide" onClick={() => { setScreen("main"); setTab("home"); }}>
          Вернуться в меню
        </button>
      </div>
    );
  }

  if (screen === "checkout") {
    return (
      <div className="page">
        <header className="topbar">
          {!isInTelegram && (
            <button className="back" onClick={() => setScreen("main")} aria-label="Назад">‹</button>
          )}
          <h1>Оформление</h1>
        </header>

        <section className="block">
          <h3>Ваш заказ</h3>
          {items.map((i) => (
            <div className="line" key={i.id}>
              <span>{i.name} × {i.qty}</span>
              <span>{formatPrice(i.qty * i.price)}</span>
            </div>
          ))}
          <div className="line total">
            <span>Итого</span>
            <span>{formatPrice(totalPrice)}</span>
          </div>
        </section>

        <section className="block">
          <h3>Доставка</h3>
          <label className="field">
            <span>Имя</span>
            <input value={form.name} onChange={updateForm("name")} placeholder="Как к вам обращаться" autoComplete="name" />
          </label>
          <label className="field">
            <span>Телефон</span>
            <input value={form.phone} onChange={updateForm("phone")} placeholder="+7 900 000-00-00" type="tel" autoComplete="tel" />
          </label>
          <label className="field">
            <span>Адрес</span>
            <input value={form.address} onChange={updateForm("address")} placeholder="Улица, дом, квартира" autoComplete="street-address" />
          </label>
          <label className="field">
            <span>Комментарий</span>
            <textarea value={form.comment} onChange={updateForm("comment")} placeholder="Без лука, код домофона" rows={2} />
          </label>
          {error && <p className="error">{error}</p>}
        </section>

        {!isInTelegram && (
          <button className="cta" onClick={submitOrder}>Подтвердить · {formatPrice(totalPrice)}</button>
        )}
        <div className="spacer" />
      </div>
    );
  }

  // ---------- Tabs ----------

  let content;

  if (tab === "home") {
    content = (
      <>
        <div className="search">
          <SearchIcon />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти в Burger Shop" />
        </div>

        {!q && (
          <div className="banners">
            <div className="banner yellow">
              <p>Бургеры с горячими скидками</p>
              <span className="banner-emoji">🍔</span>
            </div>
            <div className="banner pink">
              <p>Новинка: Веджи-бургер</p>
              <span className="banner-emoji">🥬</span>
            </div>
          </div>
        )}

        {dayDeals.length > 0 && (
          <>
            <h2 className="section-title">Бургерный день</h2>
            <div className="hscroll">
              {dayDeals.map((b) => (
                <ProductCard
                  key={b.id}
                  item={b}
                  qty={cart[b.id] || 0}
                  onAdd={() => add(b.id)}
                  onRemove={() => remove(b.id)}
                />
              ))}
            </div>
          </>
        )}

        <h2 className="section-title">Все бургеры</h2>
        <div className="grid">
          {allItems.map((b) => (
            <ProductCard key={b.id} item={b} qty={cart[b.id] || 0} onAdd={() => add(b.id)} onRemove={() => remove(b.id)} />
          ))}
        </div>
        {allItems.length === 0 && <p className="muted center-text">Ничего не найдено</p>}
      </>
    );
  }

  if (tab === "menu") {
    content = (
      <>
        <h1 className="page-title">Меню</h1>
        <div className="search">
          <SearchIcon />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по меню" />
        </div>
        <div className="grid">
          {allItems.map((b) => (
            <ProductCard key={b.id} item={b} qty={cart[b.id] || 0} onAdd={() => add(b.id)} onRemove={() => remove(b.id)} />
          ))}
        </div>
      </>
    );
  }

  if (tab === "cart") {
    content = items.length === 0 ? (
      <div className="empty">
        <div className="done-icon">🛒</div>
        <h2>Корзина пуста</h2>
        <p className="muted">Добавьте бургеры из меню</p>
        <button className="add-btn wide" onClick={() => setTab("home")}>Перейти в меню</button>
      </div>
    ) : (
      <>
        <h1 className="page-title">Корзина</h1>
        <div className="cart-list">
          {items.map((i) => (
            <div className="cart-item" key={i.id}>
              <div className="cart-emoji" style={{ background: i.bg }}>{i.emoji}</div>
              <div className="cart-info">
                <div className="card-name">{i.name}</div>
                <div className="price">{formatPrice(i.qty * i.price)}</div>
              </div>
              <div className="stepper">
                <button onClick={() => remove(i.id)}>−</button>
                <span>{i.qty}</span>
                <button onClick={() => add(i.id)}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div className="summary">
          <div className="line total">
            <span>Итого</span>
            <span>{formatPrice(totalPrice)}</span>
          </div>
        </div>
        {!isInTelegram && (
          <button className="cta" onClick={goToCheckout}>Оформить · {formatPrice(totalPrice)}</button>
        )}
      </>
    );
  }

  if (tab === "account") {
    content = (
      <div className="empty">
        <div className="done-icon">👤</div>
        <h2>Ваш аккаунт</h2>
        <p className="muted">История заказов и адреса появятся здесь</p>
      </div>
    );
  }

  return (
    <div className="page has-tabbar">
      {content}
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "tab active" : "tab"} onClick={() => setTab(t.id)}>
            <span className="tab-icon">
              {t.icon}
              {t.id === "cart" && totalCount > 0 && <span className="count">{totalCount}</span>}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
