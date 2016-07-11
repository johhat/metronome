//Source: https://en.wikipedia.org/wiki/Tempo
//Note: Several intervals overlap. Some overlap completely.
//Sorted in ascending order.
const tempoLabels = [
    {
        range: [0, 24],
        label: 'Larghissimo'
    },
    {
        range: [25, 45],
        label: 'Grave'
    },
    {
        range: [40, 60],
        label: 'Largo'
    },
    {
        range: [45, 60],
        label: 'Lento'
    },
    {
        range: [60, 66],
        label: 'Larghetto'
    },
    {
        range: [66, 76],
        label: 'Adagio'
    },
    {
        range: [72, 76],
        label: 'Adagietto'
    },
    {
        range: [76, 108],
        label: 'Andante'
    },
    {
        range: [80, 108],
        label: 'Andantino'
    },
    {
        range: [83, 85],
        label: 'Marcia moderato'
    },
    {
        range: [92, 112],
        label: 'Andante moderato'
    },
    {
        range: [108, 120],
        label: 'Moderato'
    },
    {
        range: [112, 120],
        label: 'Allegretto'
    },
    {
        range: [116, 120],
        label: 'Allegro moderato'
    },
    {
        range: [120, 168],
        label: 'Allegro'
    },
    {
        range: [168, 176],
        label: 'Vivace'
    },
    {
        range: [172, 176],
        label: 'Vivacissimo'
    },
    {
        range: [172, 176],
        label: 'Allegrissimo'
    },
    {
        range: [172, 176],
        label: 'Allegro vivace'
    },
    {
        range: [168, 200],
        label: 'Presto'
    },
    {
        range: [200, 999], //200 bmp and above. 999 as dummy for infinity.
        label: 'Prestissimo'
    }
]

export default tempoLabels