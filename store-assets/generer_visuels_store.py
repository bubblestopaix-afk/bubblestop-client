"""Génère quatre créations App Store / Google Play fidèles à la charte Bubble Stop.

Les boissons sont extraites du menu officiel fourni par Bubble Stop. Les modules
produit sont recomposés pour la fiche store : aucune capture brute plein écran et
aucun QR de compte client ou de démonstration n'est exporté.
"""

from collections import deque
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "store-assets"
SOURCES = ROOT / "tmp" / "store-design-sources"
IOS_DIR = ASSETS / "ios"
PLAY_DIR = ASSETS / "play"
FONTS = ASSETS / "fonts"
MENU = SOURCES / "menu-reference.png"
VAGUES = SOURCES / "charte-waves.png"
ETINCELLES = SOURCES / "charte-sparkles-left.png"

VIOLET = (98, 62, 145)
VIOLET_FONCE = (58, 42, 94)
VIOLET_CLAIR = (139, 99, 184)
VERT = (158, 203, 28)
VERT_PALE = (237, 246, 225)
ROSE = (242, 145, 179)
ROSE_PALE = (255, 233, 241)
JAUNE = (255, 212, 102)
JAUNE_PALE = (255, 247, 214)
CREME = (251, 242, 229)
BLANC = (255, 255, 255)

PRODUITS = {
    # Coordonnées mesurées dans l'image 7063 × 9980 extraite du menu officiel.
    "fruit_duo": ((360, 1810, 1160, 2780), (237, 246, 225)),
    "milkshake": ((3700, 6760, 4420, 7930), (251, 242, 229)),
    "matcha": ((340, 6220, 1020, 7270), (251, 242, 229)),
    "tiger_duo": ((3650, 5260, 4510, 6420), (251, 242, 229)),
}


def titre(taille: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONTS / "PaytoneOne-Regular.ttf", taille)


def outfit(taille: int, graisse: str = "Regular") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONTS / f"Outfit-{graisse}.ttf", taille)


def masque_arrondi(taille: tuple[int, int], rayon: int) -> Image.Image:
    masque = Image.new("L", taille, 0)
    ImageDraw.Draw(masque).rounded_rectangle((0, 0, *taille), radius=rayon, fill=255)
    return masque


def coller_logo(img: Image.Image, variante: str, largeur: int, xy: tuple[int, int]) -> None:
    logo = Image.open(ASSETS / "logos" / f"logo_{variante}.png").convert("RGBA")
    hauteur = round(logo.height * largeur / logo.width)
    logo = logo.resize((largeur, hauteur), Image.Resampling.LANCZOS)
    img.alpha_composite(logo, (xy[0], xy[1]))


def texte_multiligne(
    dessin: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    texte: str,
    police: ImageFont.FreeTypeFont,
    couleur: tuple[int, int, int],
    espacement: int,
    ancre: str = "la",
    alignement: str = "left",
) -> None:
    dessin.multiline_text(
        xy,
        texte,
        font=police,
        fill=couleur,
        spacing=espacement,
        anchor=ancre,
        align=alignement,
    )


def ombre_arrondie(
    img: Image.Image,
    boite: tuple[int, int, int, int],
    rayon: int,
    decalage: tuple[int, int] = (0, 20),
    flou: int = 28,
    opacite: int = 48,
) -> None:
    couche = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(couche)
    x0, y0, x1, y1 = boite
    dx, dy = decalage
    d.rounded_rectangle(
        (x0 + dx, y0 + dy, x1 + dx, y1 + dy),
        radius=rayon,
        fill=(*VIOLET_FONCE, opacite),
    )
    img.alpha_composite(couche.filter(ImageFilter.GaussianBlur(flou)))


def panneau(
    img: Image.Image,
    boite: tuple[int, int, int, int],
    couleur: tuple[int, int, int],
    rayon: int,
    bordure: tuple[int, int, int] | None = None,
) -> ImageDraw.ImageDraw:
    ombre_arrondie(img, boite, rayon)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(boite, radius=rayon, fill=couleur)
    if bordure:
        d.rounded_rectangle(boite, radius=rayon, outline=bordure, width=max(3, rayon // 10))
    return d


def decor(img: Image.Image, fond: tuple[int, int, int], variante: int) -> None:
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, img.width, img.height), fill=VIOLET)
    w, h = img.size
    vagues = Image.open(VAGUES).convert("RGBA")
    hauteur_vagues = round(h * 0.24)
    vagues = vagues.resize((w, hauteur_vagues), Image.Resampling.LANCZOS)
    img.alpha_composite(vagues, (0, h - hauteur_vagues))

    etincelles = Image.open(ETINCELLES).convert("RGBA")
    # La planche de charte utilise un ancien violet légèrement plus bleu : on
    # détoure seulement les formes blanches pour éviter tout rectangle visible.
    donnees = np.asarray(etincelles.convert("RGB"))
    alpha_motif = np.clip((np.min(donnees, axis=2).astype(np.float32) - 160) / 70 * 255, 0, 255).astype(np.uint8)
    etincelles.putalpha(Image.fromarray(alpha_motif, "L"))
    largeur_motif = round(w * 0.11)
    etincelles = etincelles.resize(
        (largeur_motif, round(etincelles.height * largeur_motif / etincelles.width)),
        Image.Resampling.LANCZOS,
    )
    img.alpha_composite(etincelles, (round(w * 0.02), round(h * 0.19)))
    img.alpha_composite(etincelles.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (round(w * 0.80), round(h * 0.08)))

    # Trois perles, motif exact de la charte, décliné dans la couleur de la scène.
    accent = [VERT, JAUNE, ROSE, VERT][variante]
    for index, rayon in enumerate((11, 8, 6)):
        x = round(w * (0.88 + index * 0.025))
        y = round(h * (0.22 + index * 0.018))
        d.ellipse((x - rayon, y - rayon, x + rayon, y + rayon), fill=accent)


def extraire_produit(nom: str) -> Image.Image:
    """Détoure un produit sans altérer ses pixels, par différence au fond du menu."""
    source = Image.open(MENU).convert("RGB")
    boite, fond = PRODUITS[nom]
    crop = source.crop(boite)
    pixels = np.asarray(crop)
    reference = np.array(fond, dtype=np.int16)
    distance = np.max(np.abs(pixels.astype(np.int16) - reference), axis=2)
    # Le fond des encarts du menu est uni. Une rampe douce garde les bords, les
    # ombres naturelles et la chantilly, tout en évitant le halo rectangulaire.
    alpha_array = np.clip((distance.astype(np.float32) - 4) / 19 * 255, 0, 255).astype(np.uint8)

    # Les recadrages du menu peuvent encore contenir une ligne de séparation ou
    # le bord d'une boisson voisine. On conserve uniquement le plus grand objet.
    petit = Image.fromarray(alpha_array, "L").resize(
        (max(1, crop.width // 4), max(1, crop.height // 4)), Image.Resampling.BILINEAR
    )
    masque = np.asarray(petit) > 35
    visite = np.zeros(masque.shape, dtype=np.uint8)
    meilleure: list[tuple[int, int]] = []
    hauteur, largeur = masque.shape
    for y in range(hauteur):
        for x in range(largeur):
            if visite[y, x] or not masque[y, x]:
                continue
            composante: list[tuple[int, int]] = []
            file: deque[tuple[int, int]] = deque([(y, x)])
            visite[y, x] = 1
            while file:
                cy, cx = file.popleft()
                composante.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < hauteur and 0 <= nx < largeur and masque[ny, nx] and not visite[ny, nx]:
                        visite[ny, nx] = 1
                        file.append((ny, nx))
            if len(composante) > len(meilleure):
                meilleure = composante

    garde = np.zeros(masque.shape, dtype=np.uint8)
    for y, x in meilleure:
        garde[y, x] = 255
    garde_img = Image.fromarray(garde, "L").filter(ImageFilter.MaxFilter(9)).resize(
        crop.size, Image.Resampling.NEAREST
    )
    alpha = Image.fromarray(alpha_array, "L")
    alpha = Image.fromarray(
        np.minimum(np.asarray(alpha), np.asarray(garde_img)).astype(np.uint8), "L"
    ).filter(ImageFilter.GaussianBlur(0.8))
    resultat = crop.convert("RGBA")
    resultat.putalpha(alpha)
    return resultat


def coller_produit(
    img: Image.Image,
    produit: Image.Image,
    boite: tuple[int, int, int, int],
    rotation: float = 0,
) -> None:
    x0, y0, x1, y1 = boite
    ratio = min((x1 - x0) / produit.width, (y1 - y0) / produit.height)
    redim = produit.resize(
        (round(produit.width * ratio), round(produit.height * ratio)),
        Image.Resampling.LANCZOS,
    )
    if rotation:
        redim = redim.rotate(rotation, resample=Image.Resampling.BICUBIC, expand=True)
    x = x0 + (x1 - x0 - redim.width) // 2
    y = y0 + (y1 - y0 - redim.height) // 2
    ombre = Image.new("RGBA", redim.size, (0, 0, 0, 0))
    ombre.putalpha(redim.getchannel("A").filter(ImageFilter.GaussianBlur(26)))
    silhouette = Image.new("RGBA", redim.size, (*VIOLET_FONCE, 0))
    silhouette.putalpha(ombre.getchannel("A").point(lambda a: round(a * 0.23)))
    img.alpha_composite(silhouette, (x + 10, y + 28))
    img.alpha_composite(redim, (x, y))


def qr_public(taille: int) -> Image.Image:
    return Image.open(ASSETS / "logos" / "qr-smart-link.png").convert("RGBA").resize(
        (taille, taille), Image.Resampling.NEAREST
    )


def pastille(
    d: ImageDraw.ImageDraw,
    centre: tuple[int, int],
    rayon: int,
    remplie: bool = True,
    numero: int | None = None,
) -> None:
    x, y = centre
    couleur = VERT if remplie else (231, 226, 240)
    d.ellipse((x - rayon, y - rayon, x + rayon, y + rayon), fill=couleur)
    if remplie:
        d.ellipse((x - rayon + 8, y - rayon + 8, x + rayon - 8, y + rayon - 8), outline=BLANC, width=3)
    if numero is not None:
        d.text((x, y + 1), str(numero), font=outfit(max(16, rayon), "Bold"), fill=VIOLET_FONCE, anchor="mm")


def carte_fidelite(img: Image.Image, boite: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = boite
    largeur, hauteur = x1 - x0, y1 - y0
    rayon = round(largeur * 0.055)
    panneau(img, boite, VIOLET, rayon)
    d = ImageDraw.Draw(img)
    coller_logo(img, "white", round(largeur * 0.38), (x0 + round(largeur * 0.08), y0 + round(hauteur * 0.07)))
    qr = qr_public(round(min(largeur, hauteur) * 0.43))
    img.alpha_composite(qr, (x0 + round(largeur * 0.08), y0 + round(hauteur * 0.25)))
    d.text(
        (x0 + round(largeur * 0.58), y0 + round(hauteur * 0.34)),
        "MON PASSAGE\nEN CAISSE",
        font=outfit(round(largeur * 0.048), "ExtraBold"),
        fill=JAUNE,
        spacing=4,
    )
    d.text(
        (x0 + round(largeur * 0.58), y0 + round(hauteur * 0.53)),
        "Un QR unique pour\nretrouver tes tampons\net ton solde.",
        font=outfit(round(largeur * 0.034), "Medium"),
        fill=BLANC,
        spacing=6,
    )
    d.rounded_rectangle(
        (x0 + round(largeur * 0.58), y0 + round(hauteur * 0.75), x1 - round(largeur * 0.07), y1 - round(hauteur * 0.10)),
        radius=24,
        fill=VERT,
    )
    d.text(
        (x0 + round(largeur * 0.765), y0 + round(hauteur * 0.825)),
        "1 / 9 TAMPONS",
        font=outfit(round(largeur * 0.033), "ExtraBold"),
        fill=VIOLET_FONCE,
        anchor="mm",
    )


def carte_tampons(img: Image.Image, boite: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = boite
    largeur, hauteur = x1 - x0, y1 - y0
    panneau(img, boite, BLANC, round(largeur * 0.065))
    d = ImageDraw.Draw(img)
    d.text((x0 + largeur * 0.09, y0 + hauteur * 0.11), "MES TAMPONS", font=outfit(round(largeur * 0.055), "ExtraBold"), fill=VIOLET_FONCE)
    d.text((x1 - largeur * 0.09, y0 + hauteur * 0.13), "9 / 9", font=outfit(round(largeur * 0.045), "Bold"), fill=VIOLET, anchor="ra")
    rayon = round(largeur * 0.065)
    for i in range(9):
        col = i % 3
        ligne = i // 3
        cx = round(x0 + largeur * (0.23 + col * 0.27))
        cy = round(y0 + hauteur * (0.34 + ligne * 0.20))
        pastille(d, (cx, cy), rayon, True, i + 1)
    d.rounded_rectangle(
        (x0 + largeur * 0.08, y1 - hauteur * 0.13, x1 - largeur * 0.08, y1 - hauteur * 0.035),
        radius=round(hauteur * 0.04),
        fill=JAUNE,
    )
    d.text(
        ((x0 + x1) // 2, y1 - hauteur * 0.082),
        "GRANDE BOISSON OFFERTE",
        font=outfit(round(largeur * 0.04), "ExtraBold"),
        fill=VIOLET_FONCE,
        anchor="mm",
    )


def carte_parrainage(img: Image.Image, boite: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = boite
    largeur, hauteur = x1 - x0, y1 - y0
    panneau(img, boite, BLANC, round(largeur * 0.06))
    d = ImageDraw.Draw(img)
    d.text((x0 + largeur * 0.08, y0 + hauteur * 0.09), "PARRAINAGE", font=outfit(round(largeur * 0.055), "ExtraBold"), fill=VIOLET_FONCE)
    qr = qr_public(round(min(largeur * 0.34, hauteur * 0.58)))
    img.alpha_composite(qr, (round(x0 + largeur * 0.08), round(y0 + hauteur * 0.26)))
    d.text((x0 + largeur * 0.50, y0 + hauteur * 0.32), "PARTAGE TON LIEN", font=outfit(round(largeur * 0.039), "Bold"), fill=VIOLET)
    d.text((x0 + largeur * 0.50, y0 + hauteur * 0.43), "Des tampons bonus\npour vous deux dès\nle premier achat.", font=outfit(round(largeur * 0.037), "Medium"), fill=VIOLET_FONCE, spacing=6)
    for index, (label, couleur) in enumerate((("+2  POUR TOI", VERT), ("+2  POUR TON AMI", ROSE))):
        haut = y0 + hauteur * (0.71 + index * 0.12)
        d.rounded_rectangle((x0 + largeur * 0.50, haut, x1 - largeur * 0.07, haut + hauteur * 0.085), radius=22, fill=couleur)
        d.text((x0 + largeur * 0.72, haut + hauteur * 0.043), label, font=outfit(round(largeur * 0.032), "ExtraBold"), fill=VIOLET_FONCE, anchor="mm")


def carte_cadeau(img: Image.Image, boite: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = boite
    largeur, hauteur = x1 - x0, y1 - y0
    panneau(img, boite, VIOLET, round(largeur * 0.065))
    d = ImageDraw.Draw(img)
    d.text((x0 + largeur * 0.08, y0 + hauteur * 0.12), "CARTE CADEAU", font=outfit(round(largeur * 0.05), "ExtraBold"), fill=JAUNE)
    d.text((x0 + largeur * 0.08, y0 + hauteur * 0.30), "TON SOLDE", font=outfit(round(largeur * 0.035), "Bold"), fill=(226, 214, 241))
    d.text((x0 + largeur * 0.08, y0 + hauteur * 0.43), "60,00 €", font=titre(round(largeur * 0.105)), fill=BLANC)
    d.text((x0 + largeur * 0.08, y0 + hauteur * 0.72), "Recharge en boutique\net paie avec ton QR fidélité.", font=outfit(round(largeur * 0.037), "Medium"), fill=BLANC, spacing=6)
    d.ellipse((x1 - largeur * 0.29, y0 + hauteur * 0.15, x1 - largeur * 0.07, y0 + hauteur * 0.47), fill=VERT)
    d.text((x1 - largeur * 0.18, y0 + hauteur * 0.31), "+20%", font=outfit(round(largeur * 0.045), "ExtraBold"), fill=VIOLET_FONCE, anchor="mm")


def puce(d: ImageDraw.ImageDraw, boite: tuple[int, int, int, int], fond: tuple[int, int, int], titre_txt: str, sous_txt: str) -> None:
    x0, y0, x1, y1 = boite
    d.rounded_rectangle(boite, radius=round((y1 - y0) * 0.32), fill=fond)
    d.text((x0 + (x1 - x0) * 0.08, y0 + (y1 - y0) * 0.28), titre_txt, font=outfit(round((y1 - y0) * 0.28), "ExtraBold"), fill=VIOLET_FONCE)
    d.text((x0 + (x1 - x0) * 0.08, y0 + (y1 - y0) * 0.65), sous_txt, font=outfit(round((y1 - y0) * 0.19), "Medium"), fill=VIOLET_FONCE)


def entete(
    img: Image.Image,
    logo: str,
    kicker: str,
    headline: str,
    sous_titre: str,
    clair: bool,
    compact: bool,
) -> None:
    d = ImageDraw.Draw(img)
    w, h = img.size
    marge = round(w * 0.065)
    col = BLANC
    accent = VERT
    coller_logo(img, "white", round(w * (0.28 if compact else 0.31)), (marge, round(h * 0.024)))
    d.text((marge, round(h * 0.081)), kicker, font=outfit(round(w * 0.025), "ExtraBold"), fill=accent)
    texte_multiligne(d, (marge, round(h * 0.105)), headline, titre(round(w * (0.061 if compact else 0.064))), col, round(w * 0.007))
    d.text((marge, round(h * (0.245 if compact else 0.235))), sous_titre, font=outfit(round(w * 0.029), "SemiBold"), fill=col)


def scene_fidelite(w: int, h: int, compact: bool, produit: Image.Image) -> Image.Image:
    img = Image.new("RGBA", (w, h))
    decor(img, VIOLET, 0)
    entete(img, "white", "FIDÉLITÉ SANS CARTE EN CARTON", "Ton QR.\nTes avantages.", "Tout est dans ta poche.", True, compact)
    panneau(img, (round(w * 0.035), round(h * 0.29), round(w * 0.965), round(h * 0.94)), VERT_PALE, round(w * 0.07), BLANC)
    d = ImageDraw.Draw(img)
    puce(d, (round(w * 0.09), round(h * 0.325), round(w * 0.72), round(h * 0.385)), ROSE, "SCANNÉ, C'EST TAMPONNÉ !", "Un passage, un avantage")
    coller_produit(img, produit, (round(w * 0.60), round(h * 0.29), round(w * 0.98), round(h * 0.57)), -4)
    carte_fidelite(img, (round(w * 0.075), round(h * 0.51), round(w * 0.925), round(h * 0.875)))
    d = ImageDraw.Draw(img)
    puce(d, (round(w * 0.15), round(h * 0.89), round(w * 0.85), round(h * 0.93)), JAUNE, "1 QR UNIQUE", "Tampons • offres • solde carte cadeau")
    return img.convert("RGB")


def scene_tampons(w: int, h: int, compact: bool, produit: Image.Image) -> Image.Image:
    img = Image.new("RGBA", (w, h))
    decor(img, VIOLET, 1)
    entete(img, "white", "TA RÉCOMPENSE", "9 tampons.\n1 grande offerte.", "Tes passages prennent de la valeur.", True, compact)
    panneau(img, (round(w * 0.035), round(h * 0.29), round(w * 0.965), round(h * 0.94)), CREME, round(w * 0.07), BLANC)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((round(w * 0.15), round(h * 0.32), round(w * 0.74), round(h * 0.365)), radius=24, fill=ROSE)
    d.text((round(w * 0.445), round(h * 0.342)), "9 PASSAGES = 1 GRAND PLAISIR", font=outfit(round(w * 0.025), "ExtraBold"), fill=VIOLET_FONCE, anchor="mm")
    carte_tampons(img, (round(w * 0.075), round(h * 0.38), round(w * 0.70), round(h * 0.855)))
    coller_produit(img, produit, (round(w * 0.59), round(h * 0.32), round(w * 0.98), round(h * 0.82)), 3)
    d = ImageDraw.Draw(img)
    puce(d, (round(w * 0.15), round(h * 0.875), round(w * 0.85), round(h * 0.93)), JAUNE, "CADEAU DISPONIBLE", "Utilise-le quand tu veux en boutique")
    return img.convert("RGB")


def scene_parrainage(w: int, h: int, compact: bool, milkshake: Image.Image, matcha: Image.Image) -> Image.Image:
    img = Image.new("RGBA", (w, h))
    decor(img, VIOLET, 2)
    entete(img, "white", "PARRAINAGE", "À deux,\nc'est encore meilleur.", "Partage. Invite. Gagnez ensemble.", True, compact)
    panneau(img, (round(w * 0.035), round(h * 0.29), round(w * 0.965), round(h * 0.94)), ROSE_PALE, round(w * 0.07), BLANC)
    coller_produit(img, milkshake, (round(w * 0.03), round(h * 0.30), round(w * 0.42), round(h * 0.59)), -5)
    coller_produit(img, matcha, (round(w * 0.64), round(h * 0.29), round(w * 0.98), round(h * 0.59)), 5)
    carte_parrainage(img, (round(w * 0.075), round(h * 0.55), round(w * 0.925), round(h * 0.89)))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((round(w * 0.28), round(h * 0.905), round(w * 0.72), round(h * 0.935)), radius=20, fill=JAUNE)
    d.text((round(w * 0.50), round(h * 0.920)), "DEUX FOIS PLUS KAWAII", font=outfit(round(w * 0.024), "ExtraBold"), fill=VIOLET_FONCE, anchor="mm")
    return img.convert("RGB")


def scene_carte_cadeau(w: int, h: int, compact: bool, produit: Image.Image) -> Image.Image:
    img = Image.new("RGBA", (w, h))
    decor(img, VIOLET, 3)
    entete(img, "white", "CARTE CADEAU", "Recharge.\nBonus. Bubble tea.", "Ton solde te suit à chaque passage.", True, compact)
    panneau(img, (round(w * 0.035), round(h * 0.29), round(w * 0.965), round(h * 0.94)), JAUNE_PALE, round(w * 0.07), BLANC)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((round(w * 0.12), round(h * 0.32), round(w * 0.70), round(h * 0.365)), radius=24, fill=ROSE)
    d.text((round(w * 0.41), round(h * 0.342)), "LE BONUS EST DÉJÀ DANS TON SOLDE", font=outfit(round(w * 0.024), "ExtraBold"), fill=VIOLET_FONCE, anchor="mm")
    coller_produit(img, produit, (round(w * 0.57), round(h * 0.29), round(w * 0.98), round(h * 0.63)), 2)
    carte_cadeau(img, (round(w * 0.075), round(h * 0.43), round(w * 0.71), round(h * 0.73)))
    d = ImageDraw.Draw(img)
    puce(d, (round(w * 0.10), round(h * 0.765), round(w * 0.90), round(h * 0.835)), VERT, "+10 % DÈS 25 €", "25 € rechargés = 27,50 € de solde")
    puce(d, (round(w * 0.10), round(h * 0.85), round(w * 0.90), round(h * 0.92)), ROSE, "+20 % DÈS 50 €", "50 € rechargés = 60 € de solde")
    return img.convert("RGB")


def generer_feature(produits: dict[str, Image.Image]) -> Image.Image:
    w, h = 1024, 500
    img = Image.new("RGBA", (w, h))
    decor(img, VIOLET, 0)
    d = ImageDraw.Draw(img)
    coller_logo(img, "white", 315, (58, 48))
    d.text((58, 170), "Ta fidélité,", font=titre(48), fill=BLANC)
    d.text((58, 230), "version Bubble Stop.", font=titre(48), fill=VERT)
    d.text((60, 318), "QR • tampons • offres • carte cadeau", font=outfit(25, "SemiBold"), fill=(239, 229, 248))
    d.rounded_rectangle((58, 383, 440, 447), radius=28, fill=JAUNE)
    d.text((249, 415), "9 TAMPONS = 1 GRANDE OFFERTE", font=outfit(18, "ExtraBold"), fill=VIOLET_FONCE, anchor="mm")
    coller_produit(img, produits["fruit_duo"], (610, 30, 1015, 490), -3)
    return img.convert("RGB")


def nettoyer_png(dossiers: Iterable[Path]) -> None:
    for dossier in dossiers:
        dossier.mkdir(parents=True, exist_ok=True)
        for fichier in dossier.glob("*.png"):
            fichier.unlink()


def main() -> None:
    if not MENU.exists():
        raise SystemExit(f"Menu officiel manquant : {MENU}")

    produits = {nom: extraire_produit(nom) for nom in PRODUITS}
    nettoyer_png((IOS_DIR, PLAY_DIR))

    scenes = (
        ("01_fidelite.png", lambda w, h, c: scene_fidelite(w, h, c, produits["fruit_duo"])),
        ("02_tampons.png", lambda w, h, c: scene_tampons(w, h, c, produits["milkshake"])),
        ("03_parrainage.png", lambda w, h, c: scene_parrainage(w, h, c, produits["milkshake"], produits["matcha"])),
        ("04_carte_cadeau.png", lambda w, h, c: scene_carte_cadeau(w, h, c, produits["tiger_duo"])),
    )

    for fichier, construire in scenes:
        construire(1242, 2688, False).save(IOS_DIR / fichier, format="PNG", optimize=True)
        construire(1080, 1920, True).save(PLAY_DIR / fichier, format="PNG", optimize=True)
    generer_feature(produits).save(PLAY_DIR / "00_feature_1024x500.png", format="PNG", optimize=True)

    print("Créations store générées depuis la charte et le menu officiels :")
    for dossier in (IOS_DIR, PLAY_DIR):
        for fichier in sorted(dossier.glob("*.png")):
            with Image.open(fichier) as image:
                print(f"- {fichier.relative_to(ROOT)} : {image.size}, {image.mode}")


if __name__ == "__main__":
    main()
