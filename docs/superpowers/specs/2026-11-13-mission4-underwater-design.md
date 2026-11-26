# Mission 4 — CORAL KINGDOM

## Intento e richieste

Aggiungere a Robot Rumble una quarta missione interamente sott'acqua, mantenendo Ines e Mathias come eroi e lo stile animato del gioco. La richiesta dell'utente è: movimento libero verso l'alto e il basso, pesci, coralli, alghe, polipi, stelle marine, cavallucci marini, delfini, razze, seppie e meduse. Alla scelta tra nuoto con maschera/pinne e piccolo sottomarino, l'utente ha risposto **«tutte due»**.

Il progetto seguente unisce quindi entrambe le modalità. Titolo, suddivisione, ruoli degli animali e boss sono proposte del progettista, non dettagli già scelti dall'utente.

## Approcci considerati

1. **Solo nuoto:** lascia sempre visibili gli eroi e introduce facilmente il movimento verticale, ma esclude il sottomarino richiesto.
2. **Solo sottomarino:** rende immediati navigazione e combattimento, ma esclude il nuoto richiesto.
3. **Nuoto + sottomarino:** scelta dell'utente. Il nuoto è sempre disponibile; nella seconda area si trova un piccolo sottomarino utilizzabile anche oltre quell'area. Deve essere possibile completare la missione senza veicolo, anche se viene abbandonato o distrutto.

## Esperienza proposta

Avventura di circa 6–9 minuti, con quattro aree, transizioni graduali di luce e colore e checkpoint tra le aree. Il mondo scorre orizzontalmente; dentro l'inquadratura esistente di 480 × 270 pixel il giocatore si muove liberamente anche in verticale. Nessuna gravità da platform durante il nuoto. Pavimento e limite superiore impediscono di uscire dalla zona giocabile.

| Area | Ambiente e contenuto |
|---|---|
| 1 — CORAL GARDEN | Acqua turchese, raggi dalla superficie, coralli ramificati, pesci in piccoli banchi, stelle marine. Arrivo degli eroi con equipaggiamento subacqueo e breve spiegazione dei comandi. Primi incontri facili. |
| 2 — KELP FOREST | Alghe alte che ondeggiano, cavallucci marini, polipi e piccoli passaggi tra rocce. Piccolo sottomarino parcheggiato e presentato con un suggerimento. Prima arena di combattimento su più altezze. |
| 3 — SUNKEN RUINS | Archi e colonne sommerse, delfini da liberare, razze robot che attraversano lo schermo e una seppia robot come incontro centrale. Zone di inchiostro temporanee con spazio libero attorno. |
| 4 — GLOWING DEEP | Coralli luminosi, meduse e tonalità blu/viola. Scorta di cuori prima della battaglia finale contro un grande polpo robot. Vittoria e prosecuzione nel flusso normale di fine missione. |

Il mare deve sembrare vivo anche fuori dal combattimento: pesci innocui, bollicine, alghe animate, animali liberati che nuotano via. Coralli e stelle sui fondali, cavallucci fra le alghe, delfini riconoscibili. Tutte le specie richieste devono comparire chiaramente nel contenuto giocabile, non soltanto nella schermata di scelta.

## Comandi e due modalità

- Frecce / WASD: destra, sinistra, su e giù in entrambe le modalità; velocità diagonale normalizzata.
- X / J: spara davanti a sé, nella direzione orizzontale in cui si guarda. Le frecce verticali servono a nuotare e non cambiano da sole la direzione del tiro. Per colpire nemici alti o bassi si cambia quota.
- C / L: attacco speciale subacqueo a scorta limitata, presentato chiaramente nel gioco.
- INVIO vicino al sottomarino: entra. INVIO a bordo: esce. Nessuna entrata automatica durante il combattimento; il mezzo rimane parcheggiato e può essere ripreso.
- P / Esc: pausa; Q dalla pausa torna al titolo, come nelle altre missioni.

Nuoto con inerzia leggera, arresto rapido e nessuna deriva fastidiosa quando si rilasciano i tasti. Maschera, bombola e pinne devono risultare leggibili e distinguere i due eroi. Il sottomarino è più rapido e resistente, con un abitacolo trasparente che mostra l'eroe e colpi adatti all'acqua. Un veicolo distrutto espelle l'eroe protetto per alcuni istanti e il nuoto continua; non deve bloccare la progressione. Nessun conto alla rovescia dell'ossigeno.

## Animali, pericoli e combattimento

Coerentemente con Robot Rumble, i nemici sono versioni robotiche degli animali e gli animali veri sono innocui o da liberare. Proposta: polipi robot con colpi d'inchiostro, razze robot che anticipano la loro attraversata, meduse robot che preannunciano la scarica, una seppia robot più resistente e il polpo robot gigante finale. Gli animali veri non devono essere danneggiabili.

La seppia avverte prima di lasciare una nube d'inchiostro locale, breve e aggirabile in verticale. Le meduse diventano visibilmente luminose prima della scarica. Le razze mostrano una preparazione prima di accelerare. Nessun attacco parte durante l'arrivo o sopra una spiegazione che copre il giocatore. Segnali di pericolo di almeno circa mezzo secondo, geometria leggibile e spazio per schivare.

Boss proposto: **MEGA OCTOPUS**, un polpo robot grande e colorato. Alterna ventagli di bolle, un attacco annunciato dei tentacoli e inchiostro evitabile cambiando quota; lascia pause sufficienti per contrattaccare. Niente catture prolungate o oscuramenti integrali. A zero energia si smonta in modo buffo con bolle, luci e pezzi di metallo, poi chiama il normale completamento della missione.

Almeno sei liberazioni distribuite tra le aree, con animali richiesti ben distinguibili: pesce, stella marina, cavalluccio, polipo, delfino e razza. Gabbie e ricompense a quote diverse rendono utile il movimento verticale. Ricompense raggiungibili senza tornare indietro, cuori nei momenti di respiro. Checkpoint prima dell'area finale e boss funzionante anche dopo un continua.

## Vincoli tecnici e conservazione

Il progetto esistente è JavaScript senza framework; `src/manifest.json` determina il caricamento e `python3 build.py` genera `index.html`, apribile con doppio clic. Non modificare il bundle a mano. Il nuovo contenuto deve usare file `level4*.js`, nomi privati in blocchi e registri separati per non sostituire quelli esistenti. Nessun nuovo asset remoto né dipendenza di rete per giocare.

Il motore supporta veicoli, nemici, proiettili, liberazioni e hook di missione. Il builder sceglierà il modo più contenuto per integrare la fisica subacquea e i due mezzi, riusando le API esistenti e limitando eventuali nuovi hook alla missione che li usa. Missioni 1–3 devono conservare fisica, comandi, dati e aspetto. Non consumare casualità all'inizializzazione o nel disegno del nuovo contenuto: le simulazioni con seed delle vecchie missioni devono rimanere confrontabili.

Con quattro missioni le attuali schede diventano troppo strette: rendere la selezione leggibile mostrando un numero limitato di schede alla volta oppure una scheda principale e anteprime laterali, mantenendo frecce e INVIO. Questa modifica deve funzionare anche con una, due o tre missioni e con le stelle salvate già presenti. Il builder sceglierà la disposizione più semplice verificandola con immagini reali.

La cartella non è un repository Git. Prima di cambiare file esistenti salvare copie in una cartella di lavoro dedicata e controllare modifiche concorrenti; altre parti del gioco sono state aggiornate durante la ricognizione. Non sovrascrivere lavoro altrui né ricostruire da copie precedenti.

## Verifica e criteri di accettazione

1. Missione 4 selezionabile, entrambi gli eroi utilizzabili, passaggio da Missione 3 e flusso finale funzionanti.
2. Movimento su/giù indipendente dall'avanzamento, limiti dell'acqua e diagonali verificati, nessuna caduta involontaria sul fondo.
3. Entrata/uscita, parcheggio, distruzione del sottomarino, morte, respawn e continua verificati; nessuno di questi passaggi può lasciare l'eroe immobile o senza comandi.
4. Tutti gli animali e gli elementi richiesti visibili nel gioco; liberazioni e ricompense raggiungibili a quote diverse.
5. Tutte le arene risolvibili e boss completabile nuotando e usando il sottomarino; niente blocchi per nemici fuori schermo o fuori quota.
6. Simulazioni deterministiche con entrambi gli eroi e più seed, controlli mirati delle nuove modalità, ispezione visiva delle quattro aree, della selezione e del boss.
7. Nessun errore o registro sconosciuto nell'harness. Verifiche appropriate sulle missioni precedenti confrontate con uno stato iniziale salvato; build finale provata anche come HTML autonomo.

## Decisioni lasciate al builder

Nomi tecnici, registrazioni e divisione dei file, lunghezza esatta del percorso, coordinate, bilanciamento, valori di energia, melodie e disegni pixel art. Mantenere l'impronta ricca e colorata delle missioni attuali, con elementi animati distintivi e buona leggibilità. Nessuna pubblicazione online è inclusa: consegna nella cartella locale del gioco.

Stato: approvato dall'utente il 13 novembre 2026; implementato nella cartella del gioco. La durata indicativa dipende dal giocatore: i bot ottimizzati di verifica completano il percorso in circa 1,5–2 minuti.
