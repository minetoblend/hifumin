import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { InventoryItem } from './inventoryItem.js';

@Entity('shop_item')
export class ShopItem {
	@PrimaryColumn('varchar', { length: 32 })
	id!: string;

	@Column('varchar', { length: 64 })
	name!: string;

	@ManyToOne(() => InventoryItem, { nullable: false })
	@JoinColumn({ name: 'item_id' })
	item!: InventoryItem;

	@Column('int')
	price!: number;

  @Column('int')
	order!: number;

	@OneToMany(() => ShopPrice, (price) => price.shopItem, { eager: true })
	prices!: ShopPrice[];
}

@Entity('shop_price')
export class ShopPrice {
	@PrimaryColumn('varchar', { name: 'shop_item_id', length: 32 })
	shopItemId!: string;

	@PrimaryColumn('varchar', { name: 'item_id', length: 32 })
	itemId!: string;

	@ManyToOne(() => ShopItem)
	@JoinColumn({ name: 'shop_item_id' })
	shopItem!: ShopItem;

	@ManyToOne(() => InventoryItem)
	@JoinColumn({ name: 'item_id' })
	item!: InventoryItem;

	@Column('int', { name: 'amount' })
	amount!: number;
}
