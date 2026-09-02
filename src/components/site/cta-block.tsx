import { ArrowLink, ButtonLink, Container, SectionTitle } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/motion";
import { studio } from "@/content/studio";

/**
 * The close. Every page except /contact ends here.
 *
 * It sits flush on the ground with no panel and no tint: the pause in front of
 * it, the centred measure and a heading one step above every other H2 do the
 * work that an inverted band used to do loudly.
 */
export function CtaBlock({
  title = "Bring the car in.",
  body = "The inspection is free and takes about forty minutes. You leave with the panel readings and a written figure, whether or not you book the work.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="py-28 md:py-40">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionTitle scale="display">{title}</SectionTitle>
          <p className="t-lead mx-auto mt-6 text-paper-dim">{body}</p>

          <div className="mt-10 flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-7">
            <ButtonLink href="/contact">Book an inspection</ButtonLink>
            <ArrowLink href={studio.phoneHref}>{studio.phone}</ArrowLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
