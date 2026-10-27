"use client";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { SimcoinsPublicProgram } from "@/lib/simcoins/model";
import { earnedCoins } from "@/lib/simcoins/engine";
import { simcoinsCopy } from "./copy";

export function SimcoinsCalculator({
  locale,
  program,
}: {
  locale: Locale;
  program: SimcoinsPublicProgram;
}) {
  const t = simcoinsCopy[locale];
  const [amount, setAmount] = useState("50");
  const [levelId, setLevelId] = useState(program.levels[0]?.id ?? "explorer");
  const level =
    program.levels.find((item) => item.id === levelId) ?? program.levels[0];
  const valid = /^\d{1,6}(?:[.,]\d{1,2})?$/.test(amount);
  const [whole, fraction = ""] = amount.replace(",", ".").split(".");
  const cents = valid
    ? Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
    : -1;
  const acceptable =
    Number.isSafeInteger(cents) && cents >= 0 && cents <= 10_000_000;
  const coins = acceptable && level ? earnedCoins(cents, level.rateBps) : null;
  return (
    <section
      className="sc-calculator sc-section"
      id="calculator"
      aria-labelledby="sc-calculator-title"
    >
      <div>
        <p className="sc-eyebrow">SIMCOINS</p>
        <h2 id="sc-calculator-title">{t.calculator}</h2>
        <p>{t.calculatorIntro}</p>
        <p className="sc-small">{t.example}</p>
      </div>
      <div className="sc-calculator-panel">
        <label htmlFor="sc-amount">{t.amount}</label>
        <div className="sc-money-input">
          <span aria-hidden="true">$</span>
          <input
            id="sc-amount"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            maxLength={10}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={!acceptable}
            aria-describedby={!acceptable ? "sc-amount-error" : undefined}
          />
        </div>
        {!acceptable && (
          <p id="sc-amount-error" role="alert" className="sc-error">
            {t.invalid}
          </p>
        )}
        <label htmlFor="sc-level">{t.level}</label>
        <select
          id="sc-level"
          value={levelId}
          onChange={(event) => setLevelId(event.target.value)}
        >
          {program.levels.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id === "traveler"
                ? locale === "es"
                  ? "Viajero · Primera compra"
                  : "Traveler · First purchase"
                : item.name}{" "}
              · {item.rateBps / 100}%
            </option>
          ))}
        </select>
        <div className="sc-estimate" aria-live="polite">
          <span>{t.estimate}</span>
          <strong>
            {coins === null ? "—" : new Intl.NumberFormat(locale).format(coins)}{" "}
            <small>SimCoins</small>
          </strong>
          <span>
            {coins === null
              ? "—"
              : new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: "USD",
                }).format(coins / program.coinsPerUsd)}{" "}
            USD
          </span>
        </div>
      </div>
    </section>
  );
}
