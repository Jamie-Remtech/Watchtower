// Homepage + tutorial copy. Every claim here is something Watchtower
// does today — keep it that way when editing.

const en = {
  nav: { tour: 'Tutorial', contact: 'Contact', open: 'Open my Watchtower', about: 'About' },
  hero: {
    kicker: 'Tactical coordination for emergency teams',
    title: 'One picture of the situation. An extra sense for every responder.',
    sub: 'Watchtower links crews, coordinators and companies on a live map of the world — and watches the sky, the ground and the team around each person, so warnings reach them before the danger does.',
    ctaOpen: 'Open my Watchtower', ctaTour: 'Take the 3-minute tutorial', ctaContact: 'Get access for my team',
  },
  problem: {
    title: 'Why it exists',
    lead: 'After-action reviews of recent disasters keep naming the same failures.',
    items: [
      ['No common picture', 'Commanders on different screens, crews on different channels — nobody sees the whole situation.'],
      ['Warnings arrive late', 'Regional forecasts generalize; a storm cell over one crew can be invisible in the area forecast.'],
      ['People go unaccounted for', 'Personnel accountability still runs on radio roll calls that are slow to notice silence.'],
    ],
  },
  features: {
    title: 'What Watchtower does',
    items: [
      ['🌍', 'A live world picture', 'Satellite, radar, cloud movement, lidar terrain, earthquakes and wildfires on one globe — every layer from a public, citable science source.'],
      ['📡', 'An extra sense around each person', 'Every five minutes the tower reads the actual radar over each crew member, the next hour of rain, and the next three days of wind, heat, cold and storms at their exact position — then pushes what matters to their phone.'],
      ['✋', 'Check-in in one tap', 'Coordinators ask "are you OK?"; everyone answers with one glove-friendly tap and their position. Silence turns amber, then red, and the tower re-alerts automatically.'],
      ['📋', 'Playbooks that run themselves', 'Response protocols as shared checklists the whole team works in real time — drafted by AI, launched from an alert in one tap, debriefed automatically afterwards.'],
      ['🗺️', 'Tactical map and comms', 'Live crew positions, markers everyone can move, team chat with voice dictation — translated into each reader\'s language. Vehicle mode turns a cab tablet into one glanceable screen.'],
      ['🩺', 'Field medical log', 'Voice-driven patient records with triage, offline queueing and an AI-composed handover for the receiving hospital.'],
      ['☀️', 'Forecasts and the season ahead', 'Your day at your position, your team\'s three-day outlook, and the El Niño / La Niña context for the months ahead.'],
      ['🏢', 'Companies and mutual aid', 'Each organization runs its own private Watchtower; linked companies share their tactical picture during joint operations.'],
      ["📈","Proof, not promises","Every prediction Watchtower makes is recorded with its variables, frozen, and checked against what really happened — alongside the region's memory of fires, floods and quakes, and a live log of every action in the operation."],
      ["🛰️","Devices and live feeds","Drones, cameras and sensors registered in one place with their live status. Video ingest is the next step on the roadmap."],
    ],
  },
  how: {
    title: 'How it helps — a real example',
    steps: [
      ['08:40', 'A violent storm cell builds over a crew. The area forecast still says 0 mm.'],
      ['08:45', 'The tower reads the radar over each crew member and finds 45 dBZ directly over one of them.'],
      ['08:45', 'Every phone in the crew buzzes: "Intense cell over your position" — in each person\'s own language.'],
      ['08:47', 'The coordinator taps Run protocol: the severe-weather checklist reaches everyone, and a check-in confirms all are sheltered.'],
      ['Later', 'An AI debrief records what happened and what to improve — the crew\'s memory for next time.'],
    ],
  },
  science: {
    title: 'Built on public science',
    lead: 'Watchtower shows its sources so you can check them.',
    sources: 'NASA GIBS satellites · NOAA GOES & Himawari · RainViewer radar · Open-Meteo & ECMWF forecasts · USGS earthquakes · NASA EONET events · NOAA Climate Prediction Center · NRCan & Esri lidar terrain',
  },
  who: {
    title: 'Who it is for',
    items: ['Wildland and structural fire crews', 'Search and rescue teams', 'EMS and medical responders', 'Emergency managers and coordinators', 'Community and volunteer response groups'],
  },
  pricing: {
    title: 'Priced to cover costs, not to profit',
    body: 'Watchtower is built to help in emergencies. Organizations pay what it costs to run their share of the service, and small volunteer crews are a priority. Tell us about your team and we will set you up.',
  },
  contact: {
    title: 'Get access or ask a question',
    name: 'Your name', email: 'Email', org: 'Organization (optional)', message: 'Tell us about your team or your question',
    topic: 'Topic', topics: { access: 'Access for my team', dispatch: 'Connect our dispatch / CAD', pricing: 'Pricing', other: 'Something else' },
    send: 'Send', sent: 'Thank you — your message reached the Watchtower team. We will reply by email.', fail: 'Could not send — please try again.',
  },
  skip: 'Skip this page next time — go straight to my account',
  footer: 'Watchtower — tactical coordination hub. Data from public scientific sources; always follow your agency\'s official direction.',
  tour: {
    title: 'Watchtower tutorial', next: 'Next', back: 'Back', done: 'Open my Watchtower', step: 'Step {n} of {total}', exit: 'Exit tutorial',
    steps: [
      ['👋', 'Welcome', 'Watchtower is your team\'s shared picture of the situation. This tour shows the main screens in about three minutes. You can open it again any time from the homepage.', ['World map with live weather', 'Your team on a tactical map', 'Alerts that come to you']],
      ['📲', 'Install it and turn on alerts', 'On your phone, open Watchtower in the browser and choose "Add to Home Screen" (or "Install app"). Then tap "Enable notifications" in the menu — alerts reach you even when the app is closed.', ['Menu → Enable notifications', 'My settings → choose your sound', 'Send yourself a test alert']],
      ['🗣️', 'Your language', 'Open My settings and pick your language. Screens follow it, and everything your team writes — messages, alerts, notes — is translated for you, with the original one tap away.', ['My settings → My language', 'Comms: "translated from…" · original', 'My settings → Appearance: light, dark, night vision, sunlight, your colour']],
      ['🌍', 'World and Forecasts', 'World is the live globe: radar, satellite clouds, wildfires, earthquakes, terrain. Forecasts gives your day and week at your position, your team\'s outlook and the season ahead.', ['Toggle layers on the globe', 'Play the radar and cloud loop', 'Forecasts → the season ahead', 'Forecasts → Area history and Track record']],
      ['📡', 'The extra sense', 'You do not have to watch the sky. Every five minutes the tower checks radar, rain, wind, heat, cold, earthquakes and fires around your position and pushes what matters. Each morning you get a short brief for your day.', ['Bell icon = everything waiting for you', 'Red = act now · amber = be aware']],
      ['✋', 'Check-in', 'When a coordinator asks for a check-in, a full screen appears: tap I\'M OK or NEED HELP. Your position goes with it. If you stay silent, the tower asks again and tells your coordinator.', ['One tap — works with gloves', 'NEED HELP alerts the whole team']],
      ['🗺️', 'Tactical map and Comms', 'The tactical map shows your team live, plus markers anyone can drag into place. Comms is the team channel — type or dictate.', ['Drag a marker from the palette', 'Tap the mic to dictate a message', 'In a vehicle: menu → Vehicle mode — one big screen, read aloud']],
      ['🩺', 'Field log', 'Record patients by voice: "new patient", "patient 2 triage red". Entries queue offline and sync later. One tap composes a hospital handover.', ['Voice commands', 'Triage board on the map', 'AI handover for the hospital']],
      ['📋', 'Protocols and the AI assistant', 'Protocols are shared checklists for situations like a fire approaching or a storm inbound. Ask the AI assistant anything about the operation — it can also start a protocol or message the team for you.', ['Run protocol from an alert', 'AI: "Start the severe weather protocol"']],
      ['🧭', 'For coordinators', 'The Team tab holds your roster, teams, invitations (QR codes) and check-in board. Settings sets alert ranges and check-in rules for your organization.', ['Invite with a QR code', 'Create teams', 'Settings → check-in thresholds']],
    ],
  },
};

const fr = {
  nav: { tour: 'Tutoriel', contact: 'Contact', open: 'Ouvrir mon Watchtower', about: 'À propos' },
  hero: {
    kicker: 'Coordination tactique pour les équipes d’urgence',
    title: 'Une seule image de la situation. Un sens de plus pour chaque intervenant.',
    sub: 'Watchtower relie équipes, coordonnateurs et organisations sur une carte du monde en direct — et surveille le ciel, le sol et l’équipe autour de chaque personne, pour que les alertes arrivent avant le danger.',
    ctaOpen: 'Ouvrir mon Watchtower', ctaTour: 'Suivre le tutoriel (3 minutes)', ctaContact: 'Obtenir l’accès pour mon équipe',
  },
  problem: {
    title: 'Pourquoi Watchtower existe',
    lead: 'Les rapports après sinistre des dernières années nomment toujours les mêmes failles.',
    items: [
      ['Pas d’image commune', 'Des commandants sur des écrans différents, des équipes sur des canaux différents — personne ne voit l’ensemble.'],
      ['Des alertes trop tardives', 'Les prévisions régionales généralisent; une cellule orageuse au-dessus d’une équipe peut être invisible dans la prévision de la région.'],
      ['Des personnes qu’on perd de vue', 'Le suivi du personnel repose encore sur des appels radio lents à remarquer le silence.'],
    ],
  },
  features: {
    title: 'Ce que fait Watchtower',
    items: [
      ['🌍', 'Une image du monde en direct', 'Satellites, radar, mouvement des nuages, relief lidar, séismes et feux de forêt sur un seul globe — chaque couche vient d’une source scientifique publique et vérifiable.'],
      ['📡', 'Un sens de plus autour de chaque personne', 'Toutes les cinq minutes, la tour lit le vrai radar au-dessus de chaque membre, la pluie de l’heure qui vient, et trois jours de vent, chaleur, froid et orages à sa position exacte — puis envoie à son téléphone ce qui compte.'],
      ['✋', 'L’appel de présence en un geste', 'Le coordonnateur demande « ça va? »; chacun répond d’un seul geste, même avec des gants, et sa position suit. Le silence passe à l’orange puis au rouge, et la tour relance automatiquement.'],
      ['📋', 'Des protocoles qui s’activent seuls', 'Des listes de vérification partagées que toute l’équipe coche en temps réel — rédigées par l’IA, lancées depuis une alerte en un geste, débriefées automatiquement ensuite.'],
      ['🗺️', 'Carte tactique et communications', 'Positions de l’équipe en direct, repères que tous peuvent déplacer, clavardage avec dictée vocale — traduit dans la langue de chaque lecteur. Le mode véhicule fait d’une tablette de cabine un seul écran lisible d’un coup d’œil.'],
      ['🩺', 'Journal médical terrain', 'Dossiers patients à la voix avec triage, file hors ligne et transfert à l’hôpital rédigé par l’IA.'],
      ['☀️', 'Prévisions et saison à venir', 'Ta journée à ta position, les trois prochains jours de ton équipe, et le contexte El Niño / La Niña pour les mois qui viennent.'],
      ['🏢', 'Organisations et entraide', 'Chaque organisation a son propre Watchtower privé; les organisations liées partagent leur image tactique lors d’opérations conjointes.'],
      ["📈","Des preuves, pas des promesses","Chaque prévision de Watchtower est consignée avec ses variables, figée, puis vérifiée contre ce qui est vraiment arrivé — avec la mémoire du secteur (feux, inondations, séismes) et un journal en direct de chaque action de l’opération."],
      ["🛰️","Appareils et flux en direct","Drones, caméras et capteurs regroupés au même endroit avec leur état en direct. La réception vidéo est la prochaine étape prévue."],
    ],
  },
  how: {
    title: 'Comment ça aide — un exemple réel',
    steps: [
      ['08 h 40', 'Une cellule orageuse violente se forme au-dessus d’une équipe. La prévision régionale indique encore 0 mm.'],
      ['08 h 45', 'La tour lit le radar au-dessus de chaque membre et trouve 45 dBZ directement au-dessus de l’un d’eux.'],
      ['08 h 45', 'Tous les téléphones de l’équipe vibrent : « Cellule intense au-dessus de ta position » — dans la langue de chacun.'],
      ['08 h 47', 'Le coordonnateur lance le protocole : la liste « météo violente » arrive à tous, et un appel de présence confirme que tout le monde est à l’abri.'],
      ['Ensuite', 'Un débriefing par l’IA consigne ce qui s’est passé et ce qu’il faut améliorer — la mémoire de l’équipe pour la prochaine fois.'],
    ],
  },
  science: {
    title: 'Fondé sur la science publique',
    lead: 'Watchtower affiche ses sources pour que tu puisses les vérifier.',
    sources: 'Satellites NASA GIBS · NOAA GOES et Himawari · radar RainViewer · prévisions Open-Meteo et ECMWF · séismes USGS · événements NASA EONET · Centre de prévision climatique de la NOAA · relief lidar RNCan et Esri',
  },
  who: {
    title: 'Pour qui',
    items: ['Pompiers forestiers et municipaux', 'Équipes de recherche et sauvetage', 'Ambulanciers et intervenants médicaux', 'Gestionnaires et coordonnateurs des mesures d’urgence', 'Groupes communautaires et bénévoles'],
  },
  pricing: {
    title: 'Un prix qui couvre les coûts, pas un profit',
    body: 'Watchtower est conçu pour aider en situation d’urgence. Les organisations paient ce que coûte leur part du service, et les petites équipes bénévoles sont une priorité. Parle-nous de ton équipe et on s’occupe du reste.',
  },
  contact: {
    title: 'Obtenir l’accès ou poser une question',
    name: 'Ton nom', email: 'Courriel', org: 'Organisation (facultatif)', message: 'Parle-nous de ton équipe ou de ta question',
    topic: 'Sujet', topics: { access: 'Accès pour mon équipe', dispatch: 'Brancher notre répartition / RAO', pricing: 'Prix', other: 'Autre chose' },
    send: 'Envoyer', sent: 'Merci — ton message est bien parvenu à l’équipe Watchtower. On te répond par courriel.', fail: 'Envoi impossible — réessaie.',
  },
  skip: 'Ne plus afficher cette page — aller directement à mon compte',
  footer: 'Watchtower — centre de coordination tactique. Données de sources scientifiques publiques; suis toujours les directives officielles de ton organisation.',
  tour: {
    title: 'Tutoriel Watchtower', next: 'Suivant', back: 'Retour', done: 'Ouvrir mon Watchtower', step: 'Étape {n} sur {total}', exit: 'Quitter le tutoriel',
    steps: [
      ['👋', 'Bienvenue', 'Watchtower est l’image partagée de la situation pour ton équipe. Ce tour présente les écrans principaux en trois minutes environ. Tu peux le rouvrir en tout temps depuis la page d’accueil.', ['Carte du monde avec la météo en direct', 'Ton équipe sur une carte tactique', 'Des alertes qui viennent à toi']],
      ['📲', 'Installer l’appli et activer les alertes', 'Sur ton téléphone, ouvre Watchtower dans le navigateur et choisis « Ajouter à l’écran d’accueil » (ou « Installer l’application »). Ensuite, touche « Activer les notifications » dans le menu — les alertes te parviennent même appli fermée.', ['Menu → Activer les notifications', 'Mes réglages → choisis ton son', 'Envoie-toi une alerte test']],
      ['🗣️', 'Ta langue', 'Ouvre Mes réglages et choisis ta langue. Les écrans la suivent, et tout ce que ton équipe écrit — messages, alertes, notes — est traduit pour toi, avec l’original à un geste.', ['Mes réglages → Ma langue', 'Comms : « traduit de… » · original', 'Mes réglages → Apparence : clair, sombre, vision de nuit, plein soleil, ta couleur']],
      ['🌍', 'Monde et Prévisions', 'Monde, c’est le globe en direct : radar, nuages satellites, feux, séismes, relief. Prévisions te donne ta journée et ta semaine à ta position, les perspectives de ton équipe et la saison à venir.', ['Active les couches sur le globe', 'Fais jouer la boucle radar et nuages', 'Prévisions → la saison qui vient', 'Prévisions → Historique du secteur et Bilan']],
      ['📡', 'Le sens de plus', 'Pas besoin de surveiller le ciel. Toutes les cinq minutes, la tour vérifie radar, pluie, vent, chaleur, froid, séismes et feux autour de ta position et t’envoie ce qui compte. Chaque matin, tu reçois un court bulletin pour ta journée.', ['La cloche = tout ce qui t’attend', 'Rouge = agir maintenant · orange = rester attentif']],
      ['✋', 'L’appel de présence', 'Quand un coordonnateur demande un appel, un écran plein apparaît : touche ÇA VA ou J’AI BESOIN D’AIDE. Ta position suit. Si tu ne réponds pas, la tour redemande et avise ton coordonnateur.', ['Un seul geste — fonctionne avec des gants', 'AIDE alerte toute l’équipe']],
      ['🗺️', 'Carte tactique et Comms', 'La carte tactique montre ton équipe en direct, plus des repères que tous peuvent glisser en place. Comms est le canal de l’équipe — écris ou dicte.', ['Glisse un repère depuis la palette', 'Touche le micro pour dicter', 'En véhicule : menu → Mode véhicule — un grand écran, lu à voix haute']],
      ['🩺', 'Journal terrain', 'Consigne les patients à la voix : « nouveau patient », « patient 2 triage rouge ». Les entrées attendent hors ligne et se synchronisent ensuite. Un geste rédige le transfert à l’hôpital.', ['Commandes vocales', 'Tableau de triage sur la carte', 'Transfert rédigé par l’IA']],
      ['📋', 'Protocoles et assistant IA', 'Les protocoles sont des listes partagées pour des situations comme un feu qui approche ou un orage qui arrive. Demande n’importe quoi sur l’opération à l’assistant IA — il peut aussi lancer un protocole ou écrire à l’équipe pour toi.', ['Lancer un protocole depuis une alerte', 'IA : « Lance le protocole météo violente »']],
      ['🧭', 'Pour les coordonnateurs', 'L’onglet Équipe regroupe ta liste, tes équipes, les invitations (codes QR) et le tableau des appels de présence. Paramètres règle les distances d’alerte et les règles d’appel pour ton organisation.', ['Inviter avec un code QR', 'Créer des équipes', 'Paramètres → seuils d’appel de présence']],
    ],
  },
};

const es = {
  nav: { tour: 'Tutorial', contact: 'Contacto', open: 'Abrir mi Watchtower', about: 'Acerca de' },
  hero: {
    kicker: 'Coordinación táctica para equipos de emergencia',
    title: 'Una sola imagen de la situación. Un sentido extra para cada respondedor.',
    sub: 'Watchtower une a brigadas, coordinadores y organizaciones en un mapa del mundo en vivo — y vigila el cielo, el suelo y el equipo alrededor de cada persona, para que las alertas lleguen antes que el peligro.',
    ctaOpen: 'Abrir mi Watchtower', ctaTour: 'Ver el tutorial (3 minutos)', ctaContact: 'Obtener acceso para mi equipo',
  },
  problem: {
    title: 'Por qué existe',
    lead: 'Los informes posteriores a desastres recientes repiten las mismas fallas.',
    items: [
      ['Sin imagen común', 'Mandos en pantallas distintas, brigadas en canales distintos — nadie ve la situación completa.'],
      ['Alertas que llegan tarde', 'Los pronósticos regionales generalizan; una celda de tormenta sobre una brigada puede no aparecer en el pronóstico de la zona.'],
      ['Personas sin rastrear', 'El control de personal aún depende de pases de lista por radio, lentos para notar el silencio.'],
    ],
  },
  features: {
    title: 'Qué hace Watchtower',
    items: [
      ['🌍', 'Una imagen del mundo en vivo', 'Satélite, radar, movimiento de nubes, relieve lidar, sismos e incendios en un solo globo — cada capa de una fuente científica pública y verificable.'],
      ['📡', 'Un sentido extra alrededor de cada persona', 'Cada cinco minutos la torre lee el radar real sobre cada miembro, la lluvia de la próxima hora y tres días de viento, calor, frío y tormentas en su posición exacta — y envía a su teléfono lo que importa.'],
      ['✋', 'Pase de lista con un toque', 'El coordinador pregunta "¿estás bien?"; todos responden con un toque, incluso con guantes, y su posición. El silencio pasa a ámbar y luego a rojo, y la torre vuelve a alertar sola.'],
      ['📋', 'Protocolos que se activan solos', 'Listas de verificación compartidas que todo el equipo completa en tiempo real — redactadas por IA, iniciadas desde una alerta con un toque, con informe posterior automático.'],
      ['🗺️', 'Mapa táctico y comunicaciones', 'Posiciones del equipo en vivo, marcadores que todos pueden mover, chat con dictado por voz — traducido al idioma de cada lector. El modo vehículo convierte la tableta de la cabina en una sola pantalla de un vistazo.'],
      ['🩺', 'Bitácora médica de campo', 'Registros de pacientes por voz con triaje, cola sin conexión y entrega al hospital redactada por IA.'],
      ['☀️', 'Pronósticos y la temporada', 'Tu día en tu posición, el panorama de tres días de tu equipo y el contexto de El Niño / La Niña para los próximos meses.'],
      ['🏢', 'Organizaciones y ayuda mutua', 'Cada organización tiene su propio Watchtower privado; las organizaciones vinculadas comparten su imagen táctica en operaciones conjuntas.'],
      ["📈","Pruebas, no promesas","Cada pronóstico de Watchtower se registra con sus variables, se congela y se compara con lo que realmente pasó — junto con la memoria de la zona (incendios, inundaciones, sismos) y un registro en vivo de cada acción de la operación."],
      ["🛰️","Dispositivos y transmisiones","Drones, cámaras y sensores registrados en un solo lugar con su estado en vivo. La recepción de video es el siguiente paso del plan."],
    ],
  },
  how: {
    title: 'Cómo ayuda — un ejemplo real',
    steps: [
      ['08:40', 'Una celda de tormenta violenta se forma sobre una brigada. El pronóstico de la zona aún dice 0 mm.'],
      ['08:45', 'La torre lee el radar sobre cada miembro y encuentra 45 dBZ justo encima de uno de ellos.'],
      ['08:45', 'Todos los teléfonos de la brigada vibran: "Celda intensa sobre tu posición" — en el idioma de cada uno.'],
      ['08:47', 'El coordinador inicia el protocolo: la lista de clima severo llega a todos y un pase de lista confirma que todos están resguardados.'],
      ['Después', 'Un informe de IA registra lo ocurrido y qué mejorar — la memoria del equipo para la próxima vez.'],
    ],
  },
  science: {
    title: 'Basado en ciencia pública',
    lead: 'Watchtower muestra sus fuentes para que puedas verificarlas.',
    sources: 'Satélites NASA GIBS · NOAA GOES y Himawari · radar RainViewer · pronósticos Open-Meteo y ECMWF · sismos USGS · eventos NASA EONET · Centro de Predicción Climática de NOAA · relieve lidar NRCan y Esri',
  },
  who: {
    title: 'Para quién es',
    items: ['Brigadas forestales y bomberos estructurales', 'Equipos de búsqueda y rescate', 'Servicios médicos de emergencia', 'Gestores y coordinadores de emergencias', 'Grupos comunitarios y voluntarios'],
  },
  pricing: {
    title: 'Un precio que cubre costos, no ganancias',
    body: 'Watchtower existe para ayudar en emergencias. Las organizaciones pagan lo que cuesta su parte del servicio, y las brigadas voluntarias pequeñas son prioridad. Cuéntanos de tu equipo y te ayudamos a empezar.',
  },
  contact: {
    title: 'Obtener acceso o hacer una pregunta',
    name: 'Tu nombre', email: 'Correo', org: 'Organización (opcional)', message: 'Cuéntanos de tu equipo o tu pregunta',
    topic: 'Tema', topics: { access: 'Acceso para mi equipo', dispatch: 'Conectar nuestro despacho / CAD', pricing: 'Precios', other: 'Otra cosa' },
    send: 'Enviar', sent: 'Gracias — tu mensaje llegó al equipo de Watchtower. Te responderemos por correo.', fail: 'No se pudo enviar — inténtalo de nuevo.',
  },
  skip: 'No mostrar esta página la próxima vez — ir directo a mi cuenta',
  footer: 'Watchtower — centro de coordinación táctica. Datos de fuentes científicas públicas; sigue siempre las indicaciones oficiales de tu organización.',
  tour: {
    title: 'Tutorial de Watchtower', next: 'Siguiente', back: 'Atrás', done: 'Abrir mi Watchtower', step: 'Paso {n} de {total}', exit: 'Salir del tutorial',
    steps: [
      ['👋', 'Bienvenida', 'Watchtower es la imagen compartida de la situación para tu equipo. Este recorrido muestra las pantallas principales en unos tres minutos. Puedes volver a abrirlo cuando quieras desde la página de inicio.', ['Mapa del mundo con clima en vivo', 'Tu equipo en un mapa táctico', 'Alertas que llegan a ti']],
      ['📲', 'Instálala y activa las alertas', 'En tu teléfono, abre Watchtower en el navegador y elige "Agregar a la pantalla de inicio" (o "Instalar app"). Luego toca "Activar notificaciones" en el menú — las alertas te llegan incluso con la app cerrada.', ['Menú → Activar notificaciones', 'Mis ajustes → elige tu sonido', 'Envíate una alerta de prueba']],
      ['🗣️', 'Tu idioma', 'Abre Mis ajustes y elige tu idioma. Las pantallas lo siguen, y todo lo que escribe tu equipo — mensajes, alertas, notas — se traduce para ti, con el original a un toque.', ['Mis ajustes → Mi idioma', 'Comunicaciones: "traducido de…" · original', 'Mis ajustes → Apariencia: claro, oscuro, visión nocturna, pleno sol, tu color']],
      ['🌍', 'Mundo y Pronósticos', 'Mundo es el globo en vivo: radar, nubes satelitales, incendios, sismos, relieve. Pronósticos te da tu día y tu semana en tu posición, el panorama de tu equipo y la temporada que viene.', ['Activa capas en el globo', 'Reproduce el radar y las nubes', 'Pronósticos → la temporada que viene', 'Pronósticos → Historia de la zona e Historial']],
      ['📡', 'El sentido extra', 'No tienes que vigilar el cielo. Cada cinco minutos la torre revisa radar, lluvia, viento, calor, frío, sismos e incendios alrededor de tu posición y te envía lo que importa. Cada mañana recibes un breve boletín de tu día.', ['La campana = todo lo pendiente', 'Rojo = actuar ya · ámbar = estar atento']],
      ['✋', 'Pase de lista', 'Cuando un coordinador pide un pase de lista, aparece una pantalla completa: toca ESTOY BIEN o NECESITO AYUDA. Tu posición va incluida. Si no respondes, la torre vuelve a preguntar y avisa a tu coordinador.', ['Un toque — funciona con guantes', 'AYUDA alerta a todo el equipo']],
      ['🗺️', 'Mapa táctico y Comunicaciones', 'El mapa táctico muestra a tu equipo en vivo, más marcadores que todos pueden arrastrar. Comunicaciones es el canal del equipo — escribe o dicta.', ['Arrastra un marcador desde la paleta', 'Toca el micrófono para dictar', 'En el vehículo: menú → Modo vehículo — una pantalla grande, leída en voz alta']],
      ['🩺', 'Bitácora de campo', 'Registra pacientes por voz: "nuevo paciente", "paciente 2 triaje rojo". Las entradas esperan sin conexión y se sincronizan después. Un toque redacta la entrega al hospital.', ['Comandos de voz', 'Tablero de triaje en el mapa', 'Entrega redactada por IA']],
      ['📋', 'Protocolos y asistente IA', 'Los protocolos son listas compartidas para situaciones como un incendio que se acerca o una tormenta que llega. Pregunta lo que sea sobre la operación al asistente IA — también puede iniciar un protocolo o escribir al equipo por ti.', ['Iniciar un protocolo desde una alerta', 'IA: "Inicia el protocolo de clima severo"']],
      ['🧭', 'Para coordinadores', 'La pestaña Equipo reúne tu lista, equipos, invitaciones (códigos QR) y el tablero de pase de lista. Ajustes define las distancias de alerta y las reglas de pase de lista de tu organización.', ['Invitar con un código QR', 'Crear equipos', 'Ajustes → umbrales de pase de lista']],
    ],
  },
};

export const CONTENT = { en, fr, es };

// Language-independent ids for features.items, in order. Every app tab
// must be covered here (scripts/check-homepage.mjs runs before each
// build): add a feature or a tutorial step when a feature ships.
export const FEATURE_IDS = ['world', 'sense', 'checkin', 'protocols', 'tactical', 'medical', 'forecasts', 'companies', 'record', 'devices'];
export const TAB_COVERAGE = {
  world: 'feature:world', forecasts: 'feature:forecasts', tactical: 'feature:tactical', comms: 'feature:tactical',
  log: 'feature:medical', protocols: 'feature:protocols', streams: 'feature:devices', activity: 'feature:record',
  team: 'tour:9', settings: 'tour:9', billing: 'pricing',
};
export const contentFor = (lang) => CONTENT[lang] ?? en;
