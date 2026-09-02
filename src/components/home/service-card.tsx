import Image from "next/image";
import Link from "next/link";
import type { Service } from "@/content/studio";
import { formatBand } from "@/lib/format";

/**
 * A service, as an object on the page: image well, then the facts.
 *
 * The image is the point — six of these are most of the site's visual weight,
 * and they are all frames from the same studio footage so the set reads as one
 * place rather than as six stock photographs.
 */
export function ServiceCard({
  service,
  image,
  priority = false,
}: {
  service: Service;
  image: string;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/services#${service.slug}`}
      className="group surface-1 flex flex-col overflow-hidden rounded-card transition-[background-color,transform] duration-300 hover:surface-2 hover:-translate-y-0.5"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          priority={priority}
          className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent"
        />
        <span className="t-mono absolute top-4 left-4 text-gold/80">{service.code}</span>
      </div>

      <div className="flex flex-1 flex-col p-6 md:p-7">
        <h3 className="text-[1.35rem] font-medium tracking-[-0.02em] text-paper">
          {service.name}
        </h3>
        <p className="mt-3 flex-1 text-[15px] leading-relaxed text-paper-dim">
          {service.summary}
        </p>

        <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-line pt-4">
          <span className="t-mono text-paper-faint">{service.duration}</span>
          <span className="text-[14.5px] text-paper">
            {formatBand(service.priceFrom, service.priceTo)}
          </span>
        </div>
      </div>
    </Link>
  );
}
