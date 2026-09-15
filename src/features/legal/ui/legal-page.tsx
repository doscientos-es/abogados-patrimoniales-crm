import { Link } from '@tanstack/react-router'

export type LegalPageKind = 'condiciones' | 'privacidad' | 'cookies' | 'terminos'

type LegalPageContent = {
  title: string
  intro: string
  sections: ReadonlyArray<{
    title: string
    paragraphs: readonly string[]
    items?: readonly string[]
  }>
}

const LEGAL_PAGES: Record<LegalPageKind, LegalPageContent> = {
  condiciones: {
    title: 'Condiciones de uso',
    intro:
      'Estas condiciones regulan el acceso y uso de LEX, la plataforma de gestión jurídica patrimonial.',
    sections: [
      {
        title: 'Aceptación y ámbito',
        paragraphs: [
          'Al acceder a LEX, la persona usuaria acepta estas condiciones y se compromete a utilizar el servicio de forma diligente, lícita y conforme a su finalidad profesional.',
          'El acceso al área de trabajo es privado y se habilita exclusivamente mediante invitación del despacho o de la persona administradora autorizada.',
        ],
      },
      {
        title: 'Uso autorizado',
        paragraphs: [
          'LEX está destinado a la organización de la actividad profesional del despacho.',
        ],
        items: [
          'Mantén tus credenciales de acceso confidenciales y no las compartas con terceros.',
          'Introduce únicamente información exacta, actualizada y cuya gestión estés autorizado a realizar.',
          'No intentes acceder a cuentas, expedientes, sistemas o datos que no te hayan sido autorizados.',
        ],
      },
      {
        title: 'Seguridad y disponibilidad',
        paragraphs: [
          'Aplicamos medidas razonables para proteger el servicio y la información gestionada. La persona usuaria debe colaborar con la seguridad del sistema y comunicar cualquier uso no autorizado que detecte.',
          'Podrán realizarse tareas de mantenimiento, mejoras o actualizaciones que afecten temporalmente a la disponibilidad del servicio.',
        ],
      },
      {
        title: 'Actualizaciones',
        paragraphs: [
          'Estas condiciones podrán actualizarse para adaptarse a cambios operativos, normativos o de seguridad. La fecha de la última versión se mostrará en esta página.',
        ],
      },
    ],
  },
  privacidad: {
    title: 'Política de privacidad',
    intro:
      'Esta política explica cómo se tratan los datos personales en relación con el uso de LEX.',
    sections: [
      {
        title: 'Responsable del tratamiento',
        paragraphs: [
          'Con carácter general, el despacho que invita a sus usuarios y gestiona los expedientes en LEX es el responsable de los datos personales que incorpora a la plataforma. LEX presta el soporte tecnológico conforme a las instrucciones y condiciones acordadas con dicho despacho.',
          'Para consultas sobre datos incluidos en un expediente, debes dirigirte al despacho responsable o a su persona administradora.',
        ],
      },
      {
        title: 'Finalidades y base jurídica',
        paragraphs: [
          'Los datos se utilizan para gestionar usuarios, contactos, oportunidades, expedientes, tareas, comunicaciones, documentos y facturación del despacho. El tratamiento se realiza para la prestación del servicio profesional, el cumplimiento de obligaciones legales y, cuando corresponda, sobre la base del consentimiento u otra legitimación aplicable.',
        ],
      },
      {
        title: 'Conservación y destinatarios',
        paragraphs: [
          'Los datos se conservarán durante la relación profesional y los plazos legales exigibles. Solo podrán acceder a ellos las personas autorizadas por el despacho y los proveedores tecnológicos necesarios para prestar el servicio, bajo las garantías contractuales y de seguridad correspondientes.',
        ],
      },
      {
        title: 'Tus derechos',
        paragraphs: [
          'Puedes solicitar el acceso, rectificación, supresión, oposición, limitación o portabilidad de tus datos ante el despacho responsable. También puedes presentar una reclamación ante la autoridad de protección de datos competente cuando consideres que el tratamiento no se ajusta a la normativa aplicable.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Política de cookies',
    intro: 'Esta página informa sobre el uso de tecnologías de almacenamiento en LEX.',
    sections: [
      {
        title: 'Qué son las cookies',
        paragraphs: [
          'Las cookies y tecnologías similares son pequeños archivos o datos que el navegador almacena para recordar información relacionada con una visita o sesión.',
        ],
      },
      {
        title: 'Uso en LEX',
        paragraphs: [
          'Las páginas públicas de LEX no emplean cookies analíticas, publicitarias ni de personalización. Al acceder al área privada, pueden utilizarse mecanismos estrictamente necesarios para mantener la sesión autenticada, proteger el acceso y recordar preferencias técnicas imprescindibles.',
        ],
      },
      {
        title: 'Gestión desde el navegador',
        paragraphs: [
          'Puedes eliminar o bloquear las cookies desde la configuración de tu navegador. Ten en cuenta que desactivar las tecnologías necesarias puede impedir el inicio de sesión o el funcionamiento correcto del área privada.',
        ],
      },
      {
        title: 'Cambios en esta política',
        paragraphs: [
          'Si se incorporan cookies no esenciales, se actualizará esta política y se solicitará el consentimiento cuando la normativa aplicable lo requiera.',
        ],
      },
    ],
  },
  terminos: {
    title: 'Términos del servicio',
    intro:
      'Estos términos establecen las reglas generales de prestación del servicio LEX para despachos y sus usuarios autorizados.',
    sections: [
      {
        title: 'Cuenta y acceso',
        paragraphs: [
          'Cada cuenta es personal e intransferible. El despacho es responsable de gestionar las invitaciones, los permisos y la baja de usuarios que ya no deban acceder al servicio.',
        ],
      },
      {
        title: 'Información gestionada',
        paragraphs: [
          'El despacho conserva la responsabilidad sobre la legitimidad, integridad y confidencialidad de la información que incorpora. Las personas usuarias deben respetar el secreto profesional, la normativa de protección de datos y las obligaciones aplicables a su actividad.',
        ],
      },
      {
        title: 'Propiedad intelectual',
        paragraphs: [
          'La plataforma, su diseño, código, marca y contenidos propios están protegidos por la normativa aplicable. La autorización de uso no transmite derechos de propiedad intelectual sobre LEX.',
        ],
      },
      {
        title: 'Suspensión y terminación',
        paragraphs: [
          'El acceso podrá suspenderse o limitarse cuando sea necesario para proteger la seguridad del servicio, cumplir una obligación legal o prevenir un uso contrario a estos términos. Las condiciones económicas, de soporte y duración se regirán, en su caso, por el acuerdo suscrito con cada despacho.',
        ],
      },
    ],
  },
}

const LINKS: ReadonlyArray<{
  to: '/condiciones' | '/privacidad' | '/cookies' | '/terminos'
  label: string
}> = [
  { to: '/condiciones', label: 'Condiciones' },
  { to: '/privacidad', label: 'Privacidad' },
  { to: '/cookies', label: 'Cookies' },
  { to: '/terminos', label: 'Términos' },
]

export function LegalPage({ page }: { page: LegalPageKind }) {
  const content = LEGAL_PAGES[page]

  return (
    <div className="bg-muted/30 min-h-screen">
      <header className="border-border bg-background/90 border-b backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Ir al acceso de LEX">
            <img src="/logo-lex.svg" alt="" className="h-8 w-8" />
            <span className="text-foreground text-lg font-semibold tracking-tight">LEX</span>
          </Link>
          <Link to="/" className="text-primary text-sm font-medium hover:underline">
            Acceder
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-primary text-sm font-semibold tracking-wide uppercase">
          Información legal
        </p>
        <h1 className="text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {content.title}
        </h1>
        <p className="text-muted-foreground mt-5 max-w-2xl text-base leading-7">{content.intro}</p>
        <p className="text-muted-foreground mt-4 text-sm">
          Última actualización: 15 de septiembre de 2026.
        </p>

        <div className="mt-10 space-y-8">
          {content.sections.map((section) => (
            <section
              key={section.title}
              className="border-border bg-card rounded-xl border p-6 shadow-sm sm:p-8"
            >
              <h2 className="text-foreground text-xl font-semibold tracking-tight">
                {section.title}
              </h2>
              <div className="text-muted-foreground mt-3 space-y-3 leading-7">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.items ? (
                  <ul className="list-disc space-y-2 pl-5">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </main>
      <footer className="border-border border-t px-5 py-8 sm:px-8">
        <nav
          aria-label="Información legal"
          className="mx-auto flex max-w-4xl flex-wrap gap-x-5 gap-y-3 text-sm"
        >
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  )
}
