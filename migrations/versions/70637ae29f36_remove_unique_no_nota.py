"""remove_unique_no_nota

Revision ID: 70637ae29f36
Revises: 638015476514
Create Date: 2026-07-16 02:00:07.932920

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '70637ae29f36'
down_revision = '638015476514'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("PRAGMA foreign_keys=off;")
    op.execute('''
        CREATE TABLE _transaksi_menu_new (
            id INTEGER NOT NULL PRIMARY KEY, 
            no_nota VARCHAR(50) NOT NULL, 
            menu_id INTEGER NOT NULL REFERENCES menu_item (id), 
            jumlah INTEGER NOT NULL, 
            total_harga INTEGER NOT NULL, 
            pc_kode VARCHAR(20), 
            tanggal DATETIME, 
            kasir_id INTEGER NOT NULL REFERENCES user (id), 
            tunai INTEGER, 
            kembalian INTEGER, 
            metode_pembayaran VARCHAR(50)
        );
    ''')
    op.execute("INSERT INTO _transaksi_menu_new SELECT id, no_nota, menu_id, jumlah, total_harga, pc_kode, tanggal, kasir_id, tunai, kembalian, metode_pembayaran FROM transaksi_menu;")
    op.execute("DROP TABLE transaksi_menu;")
    op.execute("ALTER TABLE _transaksi_menu_new RENAME TO transaksi_menu;")
    op.execute("PRAGMA foreign_keys=on;")

def downgrade():
    pass
