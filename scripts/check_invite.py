import psycopg2

conn_str = "postgresql://postgres.ewlkdrwrespnxyddwtgo:OperaOmnia#89@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"

conn = psycopg2.connect(conn_str)
conn.autocommit = True
with conn.cursor() as cur:
    # Check invitations for this email
    cur.execute("""
        SELECT i.id, i.organization_id, o.nome as org_nome, i.email, i.role,
               i.accepted_at, i.expires_at, i.created_at, i.token
        FROM public.organization_invitations i
        JOIN public.organizations o ON o.id = i.organization_id
        WHERE i.email = 'chizianetonny@gmail.com'
        ORDER BY i.created_at DESC;
    """)

    rows = cur.fetchall()
    if not rows:
        print("NENHUM convite encontrado para chizianetonny@gmail.com")
    else:
        print(f"Encontrados {len(rows)} convite(s):")
        for r in rows:
            print(f"  ID: {r[0]}")
            print(f"  Org: {r[2]} ({r[1]})")
            print(f"  Email: {r[3]}")
            print(f"  Role: {r[4]}")
            print(f"  Accepted: {r[5]}")
            print(f"  Expires: {r[6]}")
            print(f"  Created: {r[7]}")
            print(f"  Token: {r[8]}")
            print("---")

    # Check if user is already a member anywhere
    cur.execute("""
        SELECT p.id, p.email, om.organization_id, o.nome as org_nome, om.role
        FROM public.profiles p
        LEFT JOIN public.organization_members om ON om.user_id = p.id
        LEFT JOIN public.organizations o ON o.id = om.organization_id
        WHERE p.email = 'chizianetonny@gmail.com';
    """)

    rows2 = cur.fetchall()
    if rows2:
        print(f"\nProfile encontrado:")
        for r in rows2:
            print(f"  Profile ID: {r[0]}")
            print(f"  Email: {r[1]}")
            print(f"  Org: {r[3]} ({r[2]}) - Role: {r[4]}")
    else:
        print("\nNenhum profile encontrado para este email.")

conn.close()