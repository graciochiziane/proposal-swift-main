import psycopg2

conn_str = "postgresql://postgres.ewlkdrwrespnxyddwtgo:OperaOmnia#89@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"

conn = psycopg2.connect(conn_str)
conn.autocommit = True
with conn.cursor() as cur:
    cur.execute("""
        DELETE FROM public.organization_invitations
        WHERE id = '0b019783-b385-4ec0-bebf-233a56bbe374'
        RETURNING id, email;
    """)
    result = cur.fetchone()
    if result:
        print(f"Convite removido: {result[0]} ({result[1]})")
    else:
        print("Convite ja nao existia")

conn.close()