from firebase_admin import initialize_app, firestore, credentials

cred = credentials.Certificate('../credentials.json')
initialize_app(credential=cred)

def fix_plates():
    fc = firestore.client()
    cars = fc.collection('cars').stream()
    matching = [c for c in cars if c.id.startswith('MA')]
    print([c.id for c in matching])

    fixed_plates = [c.id[2:] for c in matching]
    print(fixed_plates)

    mapping = {}
    for c in matching:
        plate = c.id[2:]
        c_data = c.to_dict()
        c_data['license'] = plate
        mapping[c.id[2:]] = c_data

    print(mapping)
    
    for plate, data in mapping.items():
        fc.collection('cars').document(plate).set(data)
        
    for c in matching:
        fc.collection('cars').document(c.id).delete()

if __name__ == '__main__':
    fix_plates()