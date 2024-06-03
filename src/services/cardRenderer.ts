import { CanvasRenderingContext2D, createCanvas, Image, loadImage, registerFont } from 'canvas';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuid } from 'uuid';
import { Card } from '../entities/card.js';
import { Mapper } from '../entities/mapper.js';

const fontPath = import.meta.resolve('@expo-google-fonts/nunito-sans/').slice('file:///'.length);

registerFont(path.resolve(path.resolve(fontPath, 'NunitoSans_400Regular.ttf')), { family: 'Nunito Sans' });
registerFont(path.resolve(path.resolve(fontPath, 'NunitoSans_600SemiBold.ttf')), { family: 'Nunito Sans Semibold' });

const tmpdir = './.files/tmp';
fs.mkdirSync(tmpdir, { recursive: true });

const cardSize = {
	width: 256,
	height: 384
};

const paddedCardSize = {
	width: cardSize.width + 40,
	height: cardSize.height + 40
};

interface Options {
	cardCode?: boolean;
	perRow?: number;
}

export async function renderCard(card: Card, options: Options = {}) {
	const canvas = createCanvas(paddedCardSize.width, paddedCardSize.height);

	const ctx = canvas.getContext('2d');

	await drawCard(ctx, card, options);

	const imagePath = path.resolve(tmpdir, uuid());
	const stream = canvas.createPNGStream();
	const out = fs.createWriteStream(imagePath, { flags: 'a' });

	stream.pipe(out);

	await new Promise((resolve, reject) => {
		out.on('finish', resolve);
		out.on('error', reject);
	});

	return imagePath;
}

export async function renderCards(cards: Card[], options: Options = {}) {
	const perRow = options.perRow ?? cards.length;
	const rows = Math.ceil(cards.length / perRow);

	const canvas = createCanvas(paddedCardSize.width * perRow, paddedCardSize.height * rows);

	const ctx = canvas.getContext('2d');

	for (let i = 0; i < cards.length; i++) {
		const card = cards[i];
		const row = Math.floor(i / perRow);
		const col = i % perRow;

		ctx.save();
		ctx.translate(paddedCardSize.width * col, paddedCardSize.height * row);
		await drawCard(ctx, card, options);
		ctx.restore();
	}

	const imagePath = path.resolve(tmpdir, uuid());
	const stream = canvas.createPNGStream();
	const out = fs.createWriteStream(imagePath, { flags: 'a' });

	stream.pipe(out);

	await new Promise((resolve, reject) => {
		out.on('finish', resolve);
		out.on('error', reject);
	});

	return imagePath;
}

export async function drawCard(ctx: CanvasRenderingContext2D, card: Card, options: Options = {}) {
	const mapper = card.mapper;

	await renderFrame(ctx, mapper);

	const avatar = await loadImage(mapper.avatarUrl);

	ctx.textDrawingMode = 'path';
	ctx.antialias = 'subpixel';
	ctx.imageSmoothingEnabled = true;
	ctx.quality = 'best';

	ctx.save();
	ctx.translate(20, 20);

	// avatar
	ctx.save();
	ctx.beginPath();
	ctx.roundRect(0, 0, 256, 256 - 2, [4, 4, 0, 0]);
	ctx.clip();
	ctx.drawImage(avatar, 0, 0, 256, 256);
	ctx.restore();

	// text

	ctx.beginPath();
	ctx.font = '22px "Nunito Sans Semibold"';
	ctx.fillStyle = 'white';
	ctx.textBaseline = 'top';
	ctx.fillText(mapper.username, 14, 269);

	if (options.cardCode !== false) {
		ctx.beginPath();
		ctx.font = '16px "Nunito Sans"';
		ctx.fillStyle = '#606069';
		ctx.textBaseline = 'top';
		ctx.fillText('#' + card.id, 14, 350);
	}

	if (card.foil) {
		ctx.beginPath();
		ctx.roundRect(0, 0, cardSize.width, cardSize.height, 4);
		ctx.clip();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'multiply';
		const foil = await loadImage('assets/foil2.png');
		ctx.drawImage(foil, 0, 0, cardSize.width, cardSize.height);
        ctx.globalAlpha = 1;
	}

	ctx.restore();
}

async function renderFrame(ctx: CanvasRenderingContext2D, mapper: Mapper) {
	let frame: Image;
	if (mapper.rarity >= 40) frame = await loadImage('assets/frame_legendary.png');
	else if (mapper.rarity >= 20) frame = await loadImage('assets/frame_epic.png');
	else frame = await loadImage('assets/frame_rare.png');

	ctx.drawImage(frame, 0, 0, paddedCardSize.width, paddedCardSize.height);
}
