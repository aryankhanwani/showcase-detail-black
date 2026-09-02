"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { faqs } from "@/content/studio";

/**
 * Radix accordion on tonal rows. The open/close height animation is CSS driven
 * by `--radix-accordion-content-height` rather than Framer Motion: animating
 * height with a layout animation forces a reflow on every frame, and this list
 * can be six rows tall on a phone.
 */
export function FaqAccordion() {
  return (
    <Accordion.Root type="single" collapsible className="space-y-3 md:space-y-4">
      {faqs.map((faq, i) => (
        <Accordion.Item
          key={faq.q}
          value={`item-${i}`}
          className="surface-1 overflow-hidden rounded-card transition-colors duration-300 data-[state=open]:surface-2"
        >
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-start justify-between gap-6 p-6 text-left md:p-7">
              <span className="text-[1.05rem] leading-snug font-medium tracking-[-0.015em] text-paper md:text-[1.15rem]">
                {faq.q}
              </span>
              <span
                aria-hidden
                className="mt-1 block shrink-0 text-[22px] leading-none text-paper-faint transition-[transform,color] duration-300 group-hover:text-gold-soft group-data-[state=open]:rotate-45"
              >
                +
              </span>
            </Accordion.Trigger>
          </Accordion.Header>

          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-acc-up data-[state=open]:animate-acc-down">
            <p className="px-6 pb-6 text-[15.5px] leading-relaxed text-paper-dim md:px-7 md:pb-7 md:pr-16">
              {faq.a}
            </p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
