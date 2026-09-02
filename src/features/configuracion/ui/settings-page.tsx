import { SectionHeader } from '@/components/common'
import { ConfiguracionContactos } from '@/components/contactos/configuracion'
import { GestionEtiquetas } from '@/components/tareas/etiquetas'
import { GestionTitulosTarea } from '@/components/tareas/titulos'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { FirmSettings } from './firm-settings'

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-300">
      <SectionHeader
        title="Configuración"
        subtitle="Datos del despacho, perfil, equipo y catálogos de trabajo."
      />
      <Tabs defaultValue="despacho">
        <TabsList>
          <TabsTrigger value="despacho">Despacho</TabsTrigger>
          <TabsTrigger value="contactos">Contactos</TabsTrigger>
          <TabsTrigger value="catalogos">Catálogos</TabsTrigger>
        </TabsList>
        <TabsContent value="despacho">
          <FirmSettings />
        </TabsContent>
        <TabsContent value="contactos">
          <ConfiguracionContactos />
        </TabsContent>
        <TabsContent value="catalogos" className="space-y-4">
          <GestionEtiquetas />
          <GestionTitulosTarea />
        </TabsContent>
      </Tabs>
    </div>
  )
}
