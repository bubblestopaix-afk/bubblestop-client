import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoutonRetour, Etincelle, Message, TitreKawaii } from '@/components/ui-kit';
import { BORD, C, F, OMBRE, R } from '@/constants/charte';
import { useCatalogueCloud } from '@/data/catalogue-cloud';
import { construireCategorieVitrine, descriptionSaveur, trouverFamilleMenu } from '@/data/menu-vitrine';
import { photoCategorie } from '@/data/photos-categories';

export default function MenuCategorieScreen() {
  const insets = useSafeAreaInsets();
  const { categorieId } = useLocalSearchParams<{ categorieId: string }>();
  const { categories } = useCatalogueCloud();
  const [infoOuverte, setInfoOuverte] = useState<string | null>(null);

  const famille = useMemo(() => trouverFamilleMenu(categorieId), [categorieId]);
  const categorie: any = useMemo(
    () => (famille ? construireCategorieVitrine(categories, famille) : null),
    [categories, famille],
  );

  if (!famille || !categorie) {
    return (
      <View style={[styles.fond, styles.indisponible, { paddingTop: insets.top + 18 }]}>
        <TitreKawaii texte="Menu indisponible" sousTitre="Cette famille n’est pas disponible pour le moment." />
        <Message texte="Retourne à l’accueil pour découvrir les autres boissons." />
        <BoutonRetour onPress={() => router.replace('/' as any)} />
      </View>
    );
  }

  const photo = photoCategorie(categorie);
  const groupesMap = new Map<string, any[]>();
  for (const saveur of categorie.saveurs ?? []) {
    const groupe = String(saveur.groupe ?? '');
    groupesMap.set(groupe, [...(groupesMap.get(groupe) ?? []), saveur]);
  }
  const groupes = Array.from(groupesMap.entries());

  return (
    <View style={styles.fond}>
      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 24 }}>
        <View style={[styles.hero, categorie.heroFond ? { backgroundColor: categorie.heroFond } : null]}>
          {photo ? (
            <Image
              source={photo}
              style={styles.heroPhoto}
              resizeMode={categorie.photoMode ?? 'cover'}
              accessibilityLabel={`Photo ${famille.nom}`}
            />
          ) : (
            <View style={styles.heroSansPhoto}><Etincelle taille={42} /></View>
          )}
          <View style={[styles.retour, { top: insets.top + 10 }]}>
            <BoutonRetour onPress={() => router.back()} surPhoto={!!photo} />
          </View>
        </View>

        <View style={styles.contenu}>
          <TitreKawaii texte={famille.nom} sousTitre={famille.introduction} taille={25} />

          <View style={styles.bandeauVitrine} accessibilityRole="summary">
            <Text style={styles.bandeauTitre}>Achats uniquement en boutique</Text>
            <Text style={styles.bandeauTexte}>
              Découvre ici les familles et les saveurs, puis choisis et personnalise ta boisson directement avec notre équipe.
            </Text>
          </View>

          <TitreKawaii
            texte="Choisis ton parfum"
            sousTitre="Touche le i pour découvrir le goût de chaque saveur."
            taille={20}
          />

          <View style={styles.groupes}>
            {groupes.map(([groupe, saveurs]) => (
              <View key={groupe || 'saveurs'} style={styles.groupe}>
                {!!groupe && <Text style={styles.groupeTitre}>{groupe}</Text>}
                <View style={styles.saveurs}>
                  {saveurs.map((saveur: any) => {
                    const ouverte = infoOuverte === saveur.id;
                    const indisponible = !!saveur.horsStock;
                    return (
                      <View
                        key={saveur.id}
                        style={[styles.saveurCarte, indisponible && styles.saveurIndisponible]}
                        accessibilityLabel={`${saveur.nom}${saveur.bientot ? ', bientôt disponible' : ''}${indisponible ? ', indisponible' : ''}`}>
                        <View style={styles.saveurRang}>
                          <View style={[styles.pastilleSaveur, { backgroundColor: saveur.couleur || C.rose }]} />
                          <View style={styles.saveurTexteBloc}>
                            <View style={styles.nomRang}>
                              <Text style={styles.saveurNom}>{saveur.nom}</Text>
                              {!!saveur.reco && <Text style={styles.recommande}>COUP DE CŒUR</Text>}
                              {!!saveur.bientot && <Text style={styles.bientot}>BIENTÔT DISPONIBLE</Text>}
                            </View>
                            <View style={styles.detailsRang}>
                              {indisponible && <Text style={styles.indisponibleTexte}>Indisponible pour le moment</Text>}
                              {!!saveur.froid && <Text style={styles.froidTexte}>Froid uniquement</Text>}
                            </View>
                          </View>
                          <Pressable
                            onPress={() => setInfoOuverte(ouverte ? null : saveur.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`${ouverte ? 'Masquer' : 'Afficher'} l’explication de ${saveur.nom}`}
                            accessibilityState={{ expanded: ouverte }}
                            hitSlop={8}
                            style={({ pressed }) => [styles.infoBouton, ouverte && styles.infoBoutonActif, pressed && { opacity: 0.72 }]}>
                            <Text style={[styles.infoLettre, ouverte && styles.infoLettreActive]}>i</Text>
                          </Pressable>
                        </View>

                        {ouverte && (
                          <View style={styles.bulleInfo} accessibilityLiveRegion="polite">
                            <View style={styles.bullePointe} />
                            <Text style={styles.bulleTexte}>{descriptionSaveur(categorie, saveur)}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  indisponible: { paddingHorizontal: 20, gap: 18 },
  hero: { height: 220, backgroundColor: C.violet, overflow: 'hidden' },
  heroPhoto: { width: '100%', height: '100%' },
  heroSansPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retour: { position: 'absolute', left: 16 },
  contenu: {
    marginTop: -24, padding: 20, paddingTop: 24, gap: 18,
    backgroundColor: C.fond, borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },
  bandeauVitrine: {
    backgroundColor: C.jaunePale, borderRadius: R.carte, padding: 16, gap: 5,
    borderWidth: BORD.largeur, borderColor: BORD.surPastel,
  },
  bandeauTitre: { fontFamily: F.titre, fontSize: 16, color: C.violet },
  bandeauTexte: { fontFamily: F.t500, fontSize: 13.5, lineHeight: 19, color: C.texte },
  groupes: { gap: 18 },
  groupe: { gap: 9 },
  groupeTitre: { fontFamily: F.titre, fontSize: 17, color: C.violet, paddingLeft: 4 },
  saveurs: { gap: 11 },
  saveurCarte: {
    backgroundColor: C.carte, borderRadius: 21, padding: 14,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  saveurIndisponible: { opacity: 0.62 },
  saveurRang: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pastilleSaveur: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, borderColor: C.carte },
  saveurTexteBloc: { flex: 1, gap: 4 },
  nomRang: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  saveurNom: { fontFamily: F.titre, fontSize: 16, color: C.texte },
  recommande: {
    fontFamily: F.t800, fontSize: 8.5, letterSpacing: 0.45, color: C.roseFonce,
    backgroundColor: C.rosePale, borderRadius: R.pill, paddingHorizontal: 7, paddingVertical: 3,
  },
  bientot: {
    fontFamily: F.t800, fontSize: 8.5, letterSpacing: 0.35, color: C.violet,
    backgroundColor: C.jaunePale, borderRadius: R.pill, paddingHorizontal: 7, paddingVertical: 3,
  },
  detailsRang: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  indisponibleTexte: { fontFamily: F.t700, fontSize: 11.5, color: C.danger },
  froidTexte: { fontFamily: F.t600, fontSize: 11.5, color: C.bleu },
  infoBouton: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.lavande, borderWidth: 2, borderColor: C.violetClair,
  },
  infoBoutonActif: { backgroundColor: C.violet, borderColor: C.violet },
  infoLettre: { fontFamily: F.titre, fontSize: 18, lineHeight: 21, color: C.violet },
  infoLettreActive: { color: C.carte },
  bulleInfo: {
    marginTop: 12, marginLeft: 48, padding: 13, borderRadius: 16,
    backgroundColor: C.rosePale, borderWidth: 2, borderColor: '#F3D9E9',
  },
  bullePointe: {
    position: 'absolute', top: -7, right: 13, width: 14, height: 14,
    backgroundColor: C.rosePale, borderLeftWidth: 2, borderTopWidth: 2,
    borderColor: '#F3D9E9', transform: [{ rotate: '45deg' }],
  },
  bulleTexte: { fontFamily: F.t500, fontSize: 13.5, lineHeight: 19, color: C.texte },
});
